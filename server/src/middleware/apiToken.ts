import type { MiddlewareHandler } from "hono";
import { consumeRateLimit } from "../lib/rateLimit.js";
import { authenticateToken } from "../usecases/tokens.js";
import { UseCaseError } from "../usecases/types.js";

/**
 * Authorization: Bearer <token> を検証して Actor をコンテキストに載せる。
 *
 * browserId Cookie のミドルウェアとは排他。MCP クライアントは Cookie を送らないため、
 * /mcp を browserIdMiddleware に通すとリクエストごとに孤立した browserId が発行されてしまう。
 */
export const apiTokenMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization");
  const rawToken = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!rawToken) {
    // MCP クライアントに認証方法を知らせる
    c.header("WWW-Authenticate", 'Bearer realm="itsuhima"');
    throw new UseCaseError(
      401,
      "API トークンが必要です。Authorization: Bearer <token> ヘッダを設定してください。トークンはイツヒマの設定画面から発行できます。",
    );
  }

  const actor = await authenticateToken(rawToken);

  const { allowed, retryAfterSeconds } = consumeRateLimit(actor.tokenId ?? actor.browserId);
  if (!allowed) {
    c.header("Retry-After", String(retryAfterSeconds));
    throw new UseCaseError(429, `リクエストが多すぎます。${retryAfterSeconds} 秒後に再試行してください。`);
  }

  c.set("actor", actor);
  await next();
};
