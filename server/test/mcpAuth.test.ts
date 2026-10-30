import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { app } from "../src/main.js";
import { type ApiClient, api, createEvent, login, submit } from "./helpers.js";

const alice = { sub: "google-alice" };
const mcpUrl = `${env.PUBLIC_ORIGIN}/mcp`;
const redirectUri = "http://127.0.0.1:33418/callback";
const ALL_SCOPES = "offline_access read submit manage";

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
  const res = await api.post("/auth/oauth2/register", {
    client_name: "テスト用の MCP クライアント",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

function tokenRequest(params: Record<string, string>) {
  return app.request(
    "/api/auth/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    },
    env,
  );
}

/** ログインしたブラウザで同意し、アクセストークンを得るまで */
async function authorize(user: ApiClient, scope = ALL_SCOPES) {
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
  const authorizeRes = await user.get(`/auth/oauth2/authorize?${query}`);
  expect(authorizeRes.status).toBe(302);
  const consentUrl = new URL(authorizeRes.headers.get("Location") ?? "", env.PUBLIC_ORIGIN);
  expect(consentUrl.pathname).toBe("/oauth/consent");

  // 同意画面で「許可する」を押す
  const consentRes = await user.post("/auth/oauth2/consent", { accept: true, oauth_query: consentUrl.search.slice(1) });
  expect(consentRes.status).toBe(200);
  const callback = new URL(((await consentRes.json()) as { url: string }).url);
  expect(callback.origin + callback.pathname).toBe(redirectUri);
  expect(callback.searchParams.get("state")).toBe("state-1");

  const tokenRes = await tokenRequest({
    grant_type: "authorization_code",
    code: callback.searchParams.get("code") ?? "",
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    resource: mcpUrl,
  });
  expect(tokenRes.status).toBe(200);
  const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string; scope: string };
  return { clientId, ...tokens };
}

/** MCP の JSON-RPC を 1 回送る */
function callMcp(accessToken: string | null, method: string, params: unknown) {
  return app.request(
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

async function callTool(accessToken: string, name: string, args: Record<string, unknown>) {
  const res = await rpcResult(await callMcp(accessToken, "tools/call", { name, arguments: args }));
  if (res.error) throw new Error(`JSON-RPC のエラー: ${JSON.stringify(res.error)}`);
  return { text: res.result.content[0].text as string, isError: Boolean(res.result.isError) };
}

describe("OAuth のメタデータ", () => {
  test("保護リソースのメタデータ (RFC 9728): resource は /mcp、認可サーバーはオリジン", async () => {
    for (const path of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
      const res = await app.request(path, {}, env);

      expect(res.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: メタデータの形そのものを見るため
      const body = (await res.json()) as any;
      expect(body.resource).toBe(mcpUrl);
      expect(body.authorization_servers).toEqual([env.PUBLIC_ORIGIN]);
      expect(body.scopes_supported).toEqual(expect.arrayContaining(["read", "submit", "manage"]));
    }
  });

  test("認可サーバーのメタデータ (RFC 8414): PKCE は S256、公開クライアント、動的クライアント登録。openid などは公開しない", async () => {
    const res = await app.request("/.well-known/oauth-authorization-server", {}, env);

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: メタデータの形そのものを見るため
    const body = (await res.json()) as any;
    expect(body.issuer).toBe(env.PUBLIC_ORIGIN);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.token_endpoint_auth_methods_supported).toContain("none");
    expect(body.registration_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/register`);
    expect(body.authorization_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/authorize`);
    expect(body.token_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/token`);
    expect([...body.scopes_supported].sort()).toEqual(["manage", "offline_access", "read", "submit"]);
  });
});

describe("/mcp (OAuth)", () => {
  test("トークンが無ければ 401 と、保護リソースのメタデータを指す WWW-Authenticate", async () => {
    const res = await callMcp(null, "tools/list", {});

    expect(res.status).toBe(401);
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toContain(`resource_metadata="${env.PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp"`);
    expect(challenge).toContain('scope="read submit manage"');
  });

  test("不正なトークンは 401", async () => {
    const res = await callMcp("not-a-jwt", "tools/list", {});

    expect(res.status).toBe(401);
  });

  test("ログインして同意すると、list_events を含むツールを使える", async () => {
    const user = await login(alice);
    const { access_token, refresh_token } = await authorize(user);
    expect(refresh_token).toEqual(expect.any(String));

    const list = await rpcResult(await callMcp(access_token, "tools/list", {}));

    expect(list.result.tools.map((t: { name: string }) => t.name)).toContain("list_events");
  });

  test("MCP で作ったイベントと回答はユーザーのもので、Web でもそのユーザーだけが編集できる", async () => {
    const user = await login(alice);
    const { access_token } = await authorize(user);

    const created = await callTool(access_token, "create_event", {
      name: "定例会",
      start_date: "2026-11-02",
      end_date: "2026-11-04",
    });
    expect(created.isError).toBe(false);
    expect(created.text).toContain("設定の変更と削除は、あなただけができる");
    const id = created.text.match(/event_id: (\S+)/)?.[1] ?? "";
    const submitted = await callTool(access_token, "submit_availability", {
      event_url: id,
      name: "アリス",
      ranges: [{ start: "2026-11-02T10:00:00+09:00", end: "2026-11-02T12:00:00+09:00" }],
    });
    expect(submitted.isError).toBe(false);

    const web = (await (await user.get(`/events/${id}`)).json()) as {
      canEdit: boolean;
      participants: { isMine: boolean }[];
    };
    expect(web.canEdit).toBe(true);
    expect(web.participants).toMatchObject([{ isMine: true }]);
    const anonymous = (await (await api.get(`/events/${id}`)).json()) as { canEdit: boolean };
    expect(anonymous.canEdit).toBe(false);

    const listed = await callTool(access_token, "list_events", {});
    expect(listed.text).toContain(`event_id: ${id}`);
    expect(listed.text).toContain("作ったイベント");
    expect(listed.text).toMatch(/あなたの回答: participant_id=\S+/);

    // 2 回目の回答は断り、直し方を案内する
    const again = await callTool(access_token, "submit_availability", {
      event_url: id,
      name: "アリス",
      ranges: [{ start: "2026-11-03T10:00:00+09:00", end: "2026-11-03T12:00:00+09:00" }],
    });
    expect(again.isError).toBe(true);
    expect(again.text).toContain("update_availability");
  });

  test("ほかの人がログインして作ったイベントは、変えられない", async () => {
    const owner = await login({ sub: "google-bob" });
    const { id, optionId } = await createEvent({}, owner);
    const ownerParticipantId = await submit(id, optionId, {}, owner);
    const { access_token } = await authorize(await login(alice));

    const got = await callTool(access_token, "get_event", { event_url: id });
    expect(got.text).toContain("設定の変更と削除は、作った人だけができる");
    expect(got.text).toContain("ログインした人の回答 (その人だけが直せる)");

    const updated = await callTool(access_token, "update_event", { event_url: id, name: "乗っ取り" });
    expect(updated.isError).toBe(true);
    expect(updated.text).toContain("この操作をする権限がありません。");
    const deleted = await callTool(access_token, "delete_event", { event_url: id });
    expect(deleted.isError).toBe(true);
    const changed = await callTool(access_token, "update_availability", {
      event_url: id,
      participant_id: ownerParticipantId,
      ranges: [],
    });
    expect(changed.isError).toBe(true);
  });

  test("スコープが足りないツールは、エラーで権限を案内する", async () => {
    const { access_token } = await authorize(await login(alice), "read");

    const res = await callTool(access_token, "create_event", {
      name: "定例会",
      start_date: "2026-11-02",
      end_date: "2026-11-04",
    });

    expect(res.isError).toBe(true);
    expect(res.text).toContain("「manage」の権限が必要です");
  });

  test("接続中のアプリに出て、切ると、アクセストークンもリフレッシュトークンも使えなくなる", async () => {
    const user = await login(alice);
    const { clientId, access_token, refresh_token } = await authorize(user);

    const connections = (await (await user.get("/me/connections")).json()) as {
      clientId: string;
      name: string;
      redirectHosts: string[];
      scopes: string[];
    }[];
    expect(connections).toMatchObject([
      { clientId, name: "テスト用の MCP クライアント", redirectHosts: ["127.0.0.1"] },
    ]);
    expect(connections[0].scopes).toEqual(expect.arrayContaining(["read", "submit", "manage"]));

    expect((await user.delete(`/me/connections/${clientId}`)).status).toBe(204);

    expect(await (await user.get("/me/connections")).json()).toEqual([]);
    expect((await callMcp(access_token, "tools/list", {})).status).toBe(401);
    const refreshed = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refresh_token ?? "",
      client_id: clientId,
    });
    expect(refreshed.status).not.toBe(200);
  });

  test("アカウントを消すと、アクセストークンは使えなくなる", async () => {
    const user = await login(alice);
    const { access_token } = await authorize(user);

    await user.post("/auth/delete-user", {});

    expect((await callMcp(access_token, "tools/list", {})).status).toBe(401);
  });

  test("接続中のアプリは、ログインしていなければ 401", async () => {
    expect((await api.get("/me/connections")).status).toBe(401);
  });
});
