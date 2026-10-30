import { type Context, Hono } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";

async function auth(c: Context<AppEnv>) {
  // Better Auth は大きいので、使うときだけ読み込む
  const { createAuth } = await import("../auth.js");
  return createAuth(c.env, createDb(c.env.DB));
}

/** 保護リソースのメタデータ (RFC 9728)。mcp() プラグインが答える */
async function protectedResource(c: Context<AppEnv>) {
  return (await auth(c)).handler(c.req.raw);
}

/**
 * MCP クライアントが OAuth の設定を見つけるためのメタデータ。`/.well-known` の下を受け持つ。
 * `/mcp` (ログインして使う MCP) の 401 が、保護リソースのメタデータを指す。
 */
export const wellKnown = new Hono<AppEnv>()
  // /mcp の 401 が指す URL と、ルート (RFC 9728 の既定の場所) の両方
  .get("/oauth-protected-resource/mcp", protectedResource)
  .get("/oauth-protected-resource", protectedResource)
  // 認可サーバーのメタデータ (RFC 8414)。issuer がオリジンのルートなので、ここが正しい場所
  .get("/oauth-authorization-server", async (c) => {
    const { oauthProviderAuthServerMetadata } = await import("@better-auth/oauth-provider");
    return oauthProviderAuthServerMetadata(await auth(c))(c.req.raw);
  })
  .get("/openid-configuration", async (c) => {
    const { oauthProviderOpenIdConfigMetadata } = await import("@better-auth/oauth-provider");
    return oauthProviderOpenIdConfigMetadata(await auth(c))(c.req.raw);
  });
