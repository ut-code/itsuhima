import { createMcpHandler } from "@modelcontextprotocol/server";
import { type Context, Hono } from "hono";
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
      origin: new URL(c.req.url).origin,
    }),
  );
  return handler.fetch(c.req.raw);
}

/**
 * MCP。`/mcp` の下を受け持つ。
 * - `/mcp/public`: 認証なし。URL を知っている人が Web でできることと同じことができる
 */
export const mcp = new Hono<AppEnv>().all("/public", publicMcp);
