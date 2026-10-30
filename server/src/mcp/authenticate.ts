import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import type { Auth } from "../auth.js";
import { MCP_SCOPES, mcpResource } from "../authPlugins.js";
import type { Db } from "../db/index.js";
import { hasConnection } from "../services/connections.js";

// isolate が生きている間、JWKS をキャッシュする (期限と kid の再取得は Better Auth が扱う)
const jwksCacheKey = {};

/** アクセストークンから分かる、MCP の呼び出し元 */
export type McpPrincipal = {
  userId: string;
  /** OAuth のクライアント (Claude、ChatGPT など) */
  clientId: string;
  /** 許可されたスコープ */
  scopes: string[];
};

function unauthorized(message: string) {
  return new APIError("UNAUTHORIZED", { message });
}

/**
 * アクセストークン (JWT) を検証する。JWKS は HTTP で自分自身から取らず、Better Auth から直接読む。
 * 署名が正しくても、接続が切られている (許可が無い) トークンは受け付けない (接続中のアプリから切ったときに、すぐ効かせる)。
 * 失敗したら、MCP クライアントが OAuth を始められるよう、401 と WWW-Authenticate (resource_metadata) を返す。
 */
export async function authenticateMcp(
  request: Request,
  auth: Auth,
  db: Db,
  origin: string,
): Promise<{ principal: McpPrincipal } | { response: Response }> {
  const resource = mcpResource(origin);
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  try {
    if (!token) throw unauthorized("アクセストークンがありません");
    const claims = await verifyJwsAccessToken(token, {
      jwksFetch: () => auth.api.getJwks(),
      jwksCacheKey,
      verifyOptions: { issuer: origin, audience: resource },
    }).catch((e) => {
      // JWT として壊れているなど、jose の検証エラーは APIError で来ないので、401 にそろえる
      if (e instanceof APIError) throw e;
      throw unauthorized("アクセストークンが不正です");
    });
    const clientId = String(claims.azp ?? claims.client_id ?? "");
    if (!claims.sub || !clientId) throw unauthorized("アクセストークンにユーザーかクライアントがありません");
    if (!(await hasConnection(db, claims.sub, clientId))) throw unauthorized("接続が切られています");
    const scopes = String(claims.scope ?? "")
      .split(" ")
      .filter(Boolean);
    return { principal: { userId: claims.sub, clientId, scopes } };
  } catch (e) {
    // MCP クライアントは、ここで示したスコープをそのまま要求する (read だけだと回答や作成ができない)
    const challenge = createResourceServerChallenge(e, resource, { challengeScopes: [...MCP_SCOPES] });
    if (!challenge) throw e;
    const response = Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: challenge.message }, id: null },
      { status: challenge.statusCode, headers: challenge.headers },
    );
    return { response };
  }
}
