import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { app } from "../src/main.js";

// biome-ignore lint/suspicious/noExplicitAny: メタデータの形そのものを見るため
async function getJson(path: string): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await app.request(path, {}, env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

describe("OAuth のメタデータ", () => {
  test("保護リソースのメタデータ (RFC 9728): resource は /mcp、認可サーバーはオリジン", async () => {
    for (const path of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
      const { status, body, headers } = await getJson(path);

      expect(status).toBe(200);
      expect(body.resource).toBe(`${env.PUBLIC_ORIGIN}/mcp`);
      expect(body.authorization_servers).toEqual([env.PUBLIC_ORIGIN]);
      expect(body.scopes_supported).toEqual(expect.arrayContaining(["read", "submit", "manage"]));
      // browserId は発行しない
      expect(headers.get("Set-Cookie")).toBeNull();
    }
  });

  test("認可サーバーのメタデータ (RFC 8414): PKCE は S256、公開クライアント (none)、動的クライアント登録", async () => {
    const { status, body } = await getJson("/.well-known/oauth-authorization-server");

    expect(status).toBe(200);
    expect(body.issuer).toBe(env.PUBLIC_ORIGIN);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.token_endpoint_auth_methods_supported).toContain("none");
    expect(body.registration_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/register`);
    expect(body.authorization_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/authorize`);
    expect(body.token_endpoint).toBe(`${env.PUBLIC_ORIGIN}/api/auth/oauth2/token`);
    expect(body.scopes_supported).toEqual(expect.arrayContaining(["offline_access", "read", "submit", "manage"]));
  });

  test("OpenID の設定", async () => {
    const { status, body } = await getJson("/.well-known/openid-configuration");

    expect(status).toBe(200);
    expect(body.issuer).toBe(env.PUBLIC_ORIGIN);
    expect(body.jwks_uri).toBe(`${env.PUBLIC_ORIGIN}/api/auth/jwks`);
  });
});
