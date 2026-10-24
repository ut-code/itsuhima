import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { createBrowser, createEvent } from "./helpers.js";
import { alice, authorize, callMcp, mcpUrl, pkce, redirectUri, registerClient, rpcResult } from "./mcpHelpers.js";

describe("/mcp", () => {
  test("トークンが無ければ 401 と、保護リソースのメタデータを指す WWW-Authenticate を返す", async () => {
    const res = await callMcp(null, "tools/list", {});

    expect(res.status).toBe(401);
    const challenge = res.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer /);
    expect(challenge).toContain(`resource_metadata="${env.PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp"`);
    // MCP クライアントはこのスコープをそのまま要求するので、全部を示す
    expect(challenge).toContain('scope="read submit manage"');
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
