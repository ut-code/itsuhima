import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { app } from "../src/main.js";
import { type Browser, createBrowser, createEvent } from "./helpers.js";

const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice" };
const mcpUrl = `${env.PUBLIC_ORIGIN}/mcp`;
const redirectUri = "http://127.0.0.1:33418/callback";

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  return { verifier, challenge };
}

/** 動的クライアント登録 (Claude Code のように、ループバックの redirect_uri を持つ公開クライアント) */
async function registerClient() {
  const res = await app.request(
    "/api/auth/oauth2/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "テスト用の MCP クライアント",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    },
    env,
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

/** ブラウザでログインして同意し、アクセストークンを得るまで */
async function authorize(browser: Browser, scope: string) {
  const clientId = await registerClient();
  const { verifier, challenge } = await pkce();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: "state-1",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: mcpUrl,
  });

  // ログイン済みなので、同意画面 (/oauth/consent) に転送される
  const authorizeRes = await browser.get(`/auth/oauth2/authorize?${query}`);
  expect(authorizeRes.status).toBe(302);
  const consentUrl = new URL(authorizeRes.headers.get("Location") ?? "", env.PUBLIC_ORIGIN);
  expect(consentUrl.pathname).toBe("/oauth/consent");

  // 同意画面で「許可」を押す
  const consentRes = await browser.post("/auth/oauth2/consent", {
    accept: true,
    oauth_query: consentUrl.search.slice(1),
  });
  expect(consentRes.status).toBe(200);
  const callback = new URL(((await consentRes.json()) as { url: string }).url);
  expect(callback.origin + callback.pathname).toBe(redirectUri);
  expect(callback.searchParams.get("state")).toBe("state-1");
  const code = callback.searchParams.get("code") ?? "";

  const tokenRes = await app.request(
    "/api/auth/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: mcpUrl,
      }),
    },
    env,
  );
  expect(tokenRes.status).toBe(200);
  return (await tokenRes.json()) as { access_token: string; refresh_token?: string; scope: string };
}

/** MCP の JSON-RPC を 1 回送る (2025 年版のステートレスな呼び出し) */
async function callMcp(accessToken: string | null, method: string, params: unknown) {
  const res = await app.request(
    "/mcp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    env,
  );
  return res;
}

/** SSE か JSON の応答から、JSON-RPC の結果を取り出す */
// biome-ignore lint/suspicious/noExplicitAny: JSON-RPC の応答の形そのものを見るため
async function rpcResult(res: Response): Promise<any> {
  const text = await res.text();
  const json = res.headers.get("Content-Type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("")
    : text;
  return JSON.parse(json);
}

describe("/mcp", () => {
  test("トークンが無ければ 401 と、保護リソースのメタデータを指す WWW-Authenticate を返す", async () => {
    const res = await callMcp(null, "tools/list", {});

    expect(res.status).toBe(401);
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer /);
    expect(challenge).toContain(`resource_metadata="${env.PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp"`);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("不正なトークンは 401", async () => {
    const res = await callMcp("not-a-jwt", "tools/list", {});

    expect(res.status).toBe(401);
  });

  test("ログイン → 同意 → トークン → get_event で、自分が作ったイベントを主催者として読める", async () => {
    const browser = createBrowser();
    await browser.login(alice);
    const { id } = await createEvent(browser, { name: "定例会" });

    const token = await authorize(browser, "openid offline_access read");
    expect(token.refresh_token).toBeTruthy();

    const list = await rpcResult(await callMcp(token.access_token, "tools/list", {}));
    expect(list.result.tools.map((t: { name: string }) => t.name)).toContain("get_event");

    const call = await rpcResult(
      await callMcp(token.access_token, "tools/call", { name: "get_event", arguments: { event_id: id } }),
    );
    const text = call.result.content[0].text as string;
    expect(call.result.isError).toBeFalsy();
    expect(text).toContain(`event_id: ${id}`);
    expect(text).toContain("あなたの立場: 主催者");
    expect(text).toContain('event_name: "定例会"');
  });

  test("ログインしていなければログイン画面 (/login) に転送し、ログイン後に同じクエリで認可に戻ると同意画面に進む", async () => {
    const clientId = await registerClient();
    const { challenge } = await pkce();
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid read",
      state: "state-1",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: mcpUrl,
    });
    const browser = createBrowser();

    const anonymous = await browser.get(`/auth/oauth2/authorize?${query}`);
    expect(anonymous.status).toBe(302);
    const loginUrl = new URL(anonymous.headers.get("Location") ?? "", env.PUBLIC_ORIGIN);
    expect(loginUrl.pathname).toBe("/login");

    // ログイン画面は、Google でログインした後に /api/auth/oauth2/authorize + 同じクエリに戻す
    await browser.login(alice);
    const resumed = await browser.get(`/auth/oauth2/authorize${loginUrl.search}`);
    expect(resumed.status).toBe(302);
    expect(new URL(resumed.headers.get("Location") ?? "", env.PUBLIC_ORIGIN).pathname).toBe("/oauth/consent");

    // 同意画面に出すクライアント名
    const client = await browser.get(`/auth/oauth2/public-client?client_id=${clientId}`);
    expect(await client.json()).toMatchObject({ client_name: "テスト用の MCP クライアント" });
  });

  test("read を許可していなければ、ツールはエラーを返す", async () => {
    const browser = createBrowser();
    await browser.login(alice);
    const { id } = await createEvent(browser);

    const token = await authorize(browser, "openid submit");
    const call = await rpcResult(
      await callMcp(token.access_token, "tools/call", { name: "get_event", arguments: { event_id: id } }),
    );

    expect(call.result.isError).toBe(true);
  });
});
