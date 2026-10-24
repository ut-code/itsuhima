import type { Db } from "../db/index.js";
import type { Actor } from "../services/actor.js";

/** アクセストークンから分かる、MCP の呼び出し元 */
export type McpPrincipal = {
  userId: string;
  /** OAuth のクライアント (Claude、ChatGPT など) */
  clientId: string;
  /** 許可されたスコープ (read・submit・create など) */
  scopes: string[];
};

/** ツールに渡すもの。リクエストごとに作る */
export type McpContext = {
  db: Db;
  /** サービス層に渡す本人。MCP は常にログインしているので userId だけ */
  actor: Actor;
  principal: McpPrincipal;
  /** ブラウザから見えるオリジン (共有の URL を作るのに使う) */
  origin: string;
};

/** スコープが足りなければ、ツールのエラーの文を返す */
export function missingScope(ctx: McpContext, scope: string): string | null {
  if (ctx.principal.scopes.includes(scope)) return null;
  return `このツールには「${scope}」の権限が必要です。MCP の接続をやり直し、権限を許可してください。`;
}
