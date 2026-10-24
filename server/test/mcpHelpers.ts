/** MCP のテストで使う: OAuth を一周してアクセストークンを得る、JSON-RPC を送る */
import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { app } from "../src/main.js";
import { type Browser, createBrowser } from "./helpers.js";

export const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice" };
export const mcpUrl = `${env.PUBLIC_ORIGIN}/mcp`;
export const redirectUri = "http://127.0.0.1:33418/callback";

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  return { verifier, challenge };
}

/** 動的クライアント登録 (Claude Code のように、ループバックの redirect_uri を持つ公開クライアント) */
export async function registerClient() {
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
export async function authorize(browser: Browser, scope: string) {
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
export async function callMcp(accessToken: string | null, method: string, params: unknown) {
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
export async function rpcResult(res: Response): Promise<any> {
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

/** ツールを呼び、テキストと isError を返す */
export async function callTool(accessToken: string, name: string, args: Record<string, unknown>) {
  const res = await rpcResult(await callMcp(accessToken, "tools/call", { name, arguments: args }));
  if (res.error) throw new Error(`JSON-RPC のエラー: ${JSON.stringify(res.error)}`);
  return { text: res.result.content[0].text as string, isError: Boolean(res.result.isError) };
}

/** ログインしたブラウザで、指定したスコープのアクセストークンを得る */
export async function loginAndAuthorize(
  user: { sub: string; email: string; name: string },
  scope = "openid offline_access read submit manage",
) {
  const browser = createBrowser();
  await browser.login(user);
  const { access_token } = await authorize(browser, scope);
  return { browser, token: access_token };
}
