import { createMcpHandler } from "@modelcontextprotocol/server";
import { type Context, Hono } from "hono";
import { MCP_SCOPES } from "../authPlugins.js";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { createItsuhimaMcpServer } from "../mcp/server.js";
import { anonymousActor } from "../services/permissions.js";

/**
 * 認証なしの MCP サーバー (Streamable HTTP、ステートレス)。
 * 1 回のツール呼び出しが 1 回の POST で終わる。GET・DELETE (2025 年版のセッションの操作) には、SDK が 405 を返す。
 */
function publicMcp(c: Context<AppEnv>) {
  const handler = createMcpHandler(() =>
    createItsuhimaMcpServer({
      db: createDb(c.env.DB),
      actor: anonymousActor,
      // 匿名の人が Web でできることは、全部できる
      scopes: MCP_SCOPES,
      origin: new URL(c.req.url).origin,
    }),
  );
  return handler.fetch(c.req.raw);
}

/**
 * ログインして使う MCP サーバー。OAuth のアクセストークンで本人 (ユーザー) を決める。
 * トークンが無いか不正なら 401 を返し、MCP クライアントは OAuth を始める。
 */
async function authenticatedMcp(c: Context<AppEnv>) {
  // Better Auth は大きいので、使うときだけ読み込む
  const [{ createAuth }, { authenticateMcp }] = await Promise.all([
    import("../auth.js"),
    import("../mcp/authenticate.js"),
  ]);
  const db = createDb(c.env.DB);
  const result = await authenticateMcp(c.req.raw, createAuth(c.env, db), db, c.env.PUBLIC_ORIGIN);
  if ("response" in result) return result.response;
  const { principal } = result;

  const handler = createMcpHandler(() =>
    createItsuhimaMcpServer({
      db,
      actor: { userId: principal.userId },
      scopes: principal.scopes,
      origin: c.env.PUBLIC_ORIGIN,
    }),
  );
  return handler.fetch(c.req.raw, {
    authInfo: { token: "", clientId: principal.clientId, scopes: principal.scopes },
  });
}

/**
 * MCP。`/mcp` の下を受け持つ。
 * - `/mcp`: OAuth (Google でログイン)。ログインした人として、自分のイベントの一覧 (`list_events`) も使える
 * - `/mcp/public`: 認証なし。URL を知っている人が Web でできることと同じことができる
 */
export const mcp = new Hono<AppEnv>().all("/", authenticatedMcp).all("/public", publicMcp);
