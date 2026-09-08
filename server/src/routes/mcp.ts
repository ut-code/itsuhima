import { StreamableHTTPTransport } from "@hono/mcp";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createMcpServer } from "../mcp/server.js";
import { apiTokenMiddleware } from "../middleware/apiToken.js";
import { redeemPairingCode } from "../usecases/tokens.js";
import type { Actor, Scope } from "../usecases/types.js";
import { SCOPES } from "../usecases/types.js";

export type McpVariables = {
  actor: Actor;
};

const pairReqSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "連携コードは 6 桁の数字です"),
  client_name: z.string().min(1).max(100).default("MCP クライアント"),
  scopes: z.array(z.enum(SCOPES)).min(1).optional(),
});

const router = new Hono<{ Variables: McpVariables }>()
  /**
   * 連携コードを API トークンに引き換える。
   * MCP クライアントはまだトークンを持っていないので、ここだけ認証不要。
   */
  .post("/pair", zValidator("json", pairReqSchema), async (c) => {
    const { code, client_name, scopes } = c.req.valid("json");
    const issued = await redeemPairingCode(code, client_name, (scopes as Scope[] | undefined) ?? SCOPES);
    return c.json(issued, 201);
  })

  /**
   * MCP の Streamable HTTP エンドポイント。
   *
   * fly.io の auto_stop_machines でマシンが停止してもセッションが壊れないよう stateless で扱う
   * （sessionIdGenerator: undefined）。ツールは全てリクエスト完結なので支障はない。
   */
  .all("/", apiTokenMiddleware, async (c) => {
    const server = createMcpServer(c.get("actor"));
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(c);
    } finally {
      // stateless なのでリクエストごとに破棄する
      await transport.close();
      await server.close();
    }
  });

export default router;
