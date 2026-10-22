import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { APIError } from "better-auth/api";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import { Hono } from "hono";
import { createAuth } from "../auth.js";
import { mcpResource } from "../authPlugins.js";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import type { McpPrincipal } from "../mcp/context.js";
import { createItsuhimaMcpServer } from "../mcp/server.js";

// isolate が生きている間、JWKS をキャッシュする (期限と kid の再取得は Better Auth が扱う)
const jwksCacheKey = {};

/**
 * アクセストークン (JWT) を検証する。JWKS は HTTP で自分自身から取らず、Better Auth から直接読む。
 * 失敗したら、MCP クライアントが OAuth を始められるよう、401 と WWW-Authenticate (resource_metadata) を返す。
 */
async function authenticate(request: Request, auth: ReturnType<typeof createAuth>, origin: string) {
  const resource = mcpResource(origin);
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  try {
    if (!token) {
      throw new APIError("UNAUTHORIZED", { message: "アクセストークンがありません" });
    }
    const claims = await verifyJwsAccessToken(token, {
      jwksFetch: () => auth.api.getJwks(),
      jwksCacheKey,
      verifyOptions: { issuer: origin, audience: resource },
    }).catch((e) => {
      // JWT として壊れているなど、jose の検証エラーは APIError で来ないので、401 にそろえる
      if (e instanceof APIError) throw e;
      throw new APIError("UNAUTHORIZED", { message: "アクセストークンが不正です" });
    });
    if (!claims.sub) {
      throw new APIError("UNAUTHORIZED", { message: "アクセストークンにユーザーがありません" });
    }
    const principal: McpPrincipal = {
      userId: claims.sub,
      clientId: String(claims.azp ?? claims.client_id ?? ""),
      scopes: String(claims.scope ?? "")
        .split(" ")
        .filter(Boolean),
    };
    return { principal };
  } catch (e) {
    const challenge = createResourceServerChallenge(e, resource, { challengeScopes: ["read"] });
    if (!challenge) throw e;
    const response = Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: challenge.message }, id: null },
      { status: challenge.statusCode, headers: challenge.headers },
    );
    return { response };
  }
}

/**
 * MCP サーバー (Streamable HTTP、ステートレス)。1 回のツール呼び出しが 1 回の POST で終わる。
 * browserId は発行しない (MCP クライアントは Cookie を送らない)。
 */
const mcp = new Hono<AppEnv>().on(["POST", "GET", "DELETE"], "/mcp", async (c) => {
  const origin = c.env.PUBLIC_ORIGIN;
  const db = createDb(c.env.DB);
  const auth = createAuth(c.env, db);

  const result = await authenticate(c.req.raw, auth, origin);
  if (result.response) return result.response;
  const { principal } = result;

  // GET・DELETE (2025 年版のセッションの操作) には、ステートレスなので 405 を返す (SDK が扱う)
  const handler = createMcpHandler(() =>
    createItsuhimaMcpServer({ db, actor: { browserId: null, userId: principal.userId }, principal, origin }),
  );
  return handler.fetch(c.req.raw, {
    authInfo: { token: "", clientId: principal.clientId, scopes: principal.scopes },
  });
});

export default mcp;
