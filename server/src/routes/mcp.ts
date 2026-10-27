import { Hono } from "hono";
import type { AppEnv } from "../env.js";

/**
 * MCP サーバー。本体は mcp/handler.ts。
 * MCP の SDK と Better Auth は初期化が重いので、/mcp に来たときだけ初期化する (バンドルは分かれず、遅れるのはモジュールの初期化)。
 * そのため、このファイルは軽いものしか静的に import しない。mcp/handler.ts を静的に import すると、
 * API で遅らせている Better Auth の初期化も起動時に走る。
 */
const mcp = new Hono<AppEnv>().on(["POST", "GET", "DELETE"], "/", async (c) => {
  const { handleMcp } = await import("../mcp/handler.js");
  return handleMcp(c);
});

export default mcp;
