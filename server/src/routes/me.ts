import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../main.js";
import { createPairingCode, listTokens, revokeToken } from "../usecases/tokens.js";

/**
 * MCP 連携の設定用。ブラウザの browserId Cookie で認証する。
 * itsuhima にはアカウントが無いため、Cookie を持つブラウザ自身が
 * 「どの browserId にトークンを紐づけるか」を決める唯一の主体になる。
 */
const router = new Hono<{ Variables: AppVariables }>()
  // 連携コードの発行
  .post("/pairing-codes", async (c) => {
    const result = await createPairingCode(c.get("browserId"));
    return c.json(result, 201);
  })

  // 発行済みトークンの一覧
  .get("/tokens", async (c) => {
    const tokens = await listTokens(c.get("browserId"));
    return c.json(tokens, 200);
  })

  // トークンの失効
  .delete("/tokens/:tokenId", zValidator("param", z.object({ tokenId: z.string().uuid() })), async (c) => {
    const { tokenId } = c.req.valid("param");
    await revokeToken(c.get("browserId"), tokenId);
    return c.json({ message: "トークンを失効しました。" }, 200);
  });

export default router;
