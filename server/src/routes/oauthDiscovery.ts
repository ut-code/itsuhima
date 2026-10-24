import { Hono } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";

/**
 * MCP クライアントが OAuth の設定を見つけるためのメタデータ。オリジンのルートで配信する。
 * browserId を発行しない (MCP クライアントは Cookie を送らないので、リクエストのたびに発行されてしまう)。
 */
const oauthDiscovery = new Hono<AppEnv>()
  // 保護リソースのメタデータ (RFC 9728)。/mcp の 401 が指す URL と、ルートの両方。mcp() プラグインが答える
  .get("/.well-known/oauth-protected-resource/mcp", async (c) => {
    const { createAuth } = await import("../auth.js");
    return createAuth(c.env, createDb(c.env.DB)).handler(c.req.raw);
  })
  .get("/.well-known/oauth-protected-resource", async (c) => {
    const { createAuth } = await import("../auth.js");
    return createAuth(c.env, createDb(c.env.DB)).handler(c.req.raw);
  })
  // 認可サーバーのメタデータ (RFC 8414)。issuer がオリジンのルートなので、ここが正しい場所
  .get("/.well-known/oauth-authorization-server", async (c) => {
    const [{ createAuth }, { oauthProviderAuthServerMetadata }] = await Promise.all([
      import("../auth.js"),
      import("@better-auth/oauth-provider"),
    ]);
    return oauthProviderAuthServerMetadata(createAuth(c.env, createDb(c.env.DB)))(c.req.raw);
  })
  .get("/.well-known/openid-configuration", async (c) => {
    const [{ createAuth }, { oauthProviderOpenIdConfigMetadata }] = await Promise.all([
      import("../auth.js"),
      import("@better-auth/oauth-provider"),
    ]);
    return oauthProviderOpenIdConfigMetadata(createAuth(c.env, createDb(c.env.DB)))(c.req.raw);
  });

export default oauthDiscovery;
