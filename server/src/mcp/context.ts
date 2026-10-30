import type { Db } from "../db/index.js";
import type { Actor } from "../services/permissions.js";

/** ツールに渡すもの。リクエストごとに作る */
export type McpContext = {
  db: Db;
  /** サービス層に渡す本人。`/mcp` は認証が無いので、いつも匿名 */
  actor: Actor;
  /** ブラウザから見えるオリジン (共有の URL を作るのに使う) */
  origin: string;
};

/** イベントのページの URL */
export function eventUrl(ctx: McpContext, eventId: string): string {
  return `${ctx.origin}/e/${eventId}`;
}
