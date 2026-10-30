import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../env.js";
import { listConnections, revokeConnection } from "../services/connections.js";
import { listMyEvents } from "../services/events.js";

/** ログインしていなければ 401 */
const requireLogin = createMiddleware<AppEnv & { Variables: { userId: string } }>(async (c, next) => {
  const { userId } = c.get("actor");
  if (userId === null) {
    return c.json({ message: "ログインしてください。" }, 401);
  }
  c.set("userId", userId);
  return next();
});

/** ログインした人のもの */
const router = new Hono<AppEnv>()
  .use("*", requireLogin)

  // 作ったイベントと回答したイベント。client は localStorage の控えと合わせて一覧を出す
  .get("/events", async (c) => {
    const events = await listMyEvents(c.get("db"), c.get("userId"));
    return c.json(events, 200);
  })

  // MCP で接続中のアプリ
  .get("/connections", async (c) => {
    const connections = await listConnections(c.get("db"), c.get("userId"));
    return c.json(connections, 200);
  })

  // 接続を切る
  .delete("/connections/:clientId", zValidator("param", z.object({ clientId: z.string().min(1) })), async (c) => {
    await revokeConnection(c.get("db"), c.get("userId"), c.req.valid("param").clientId);
    return c.body(null, 204);
  });

export default router;
