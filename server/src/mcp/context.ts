import type { McpScope } from "../authPlugins.js";
import type { Db } from "../db/index.js";
import type { Actor } from "../services/permissions.js";

/** ツールに渡すもの。リクエストごとに作る */
export type McpContext = {
  db: Db;
  /** サービス層に渡す本人。`/mcp` はログインしたユーザー、`/mcp/public` は匿名 */
  actor: Actor;
  /** 許可されたスコープ (`/mcp` はアクセストークンのもの、`/mcp/public` は全部) */
  scopes: readonly string[];
  /** ブラウザから見えるオリジン (共有の URL を作るのに使う) */
  origin: string;
};

/** イベントのページの URL */
export function eventUrl(ctx: McpContext, eventId: string): string {
  return `${ctx.origin}/e/${eventId}`;
}

/** ログインして使っているか (`/mcp`) */
export function isLoggedIn(ctx: McpContext) {
  return ctx.actor.userId !== null;
}

/** スコープが足りなければ、ツールのエラーの文を返す */
export function missingScope(ctx: McpContext, scope: McpScope): string | null {
  if (ctx.scopes.includes(scope)) return null;
  return `このツールには「${scope}」の権限が必要です。MCP の接続をやり直し、権限を許可してください。`;
}
