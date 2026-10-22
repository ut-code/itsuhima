import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import type { AppEnv } from "../env.js";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listMyEvents,
  submitAvailability,
  updateEvent,
  updateMyAvailability,
} from "../services/events.js";

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

const router = new Hono<AppEnv>()
  // イベント作成
  .post("/", zValidator("json", projectReqSchema), async (c) => {
    const event = await createEvent(c.get("db"), c.get("browserId"), c.req.valid("json"));
    return c.json({ id: event.id, name: event.name }, 201);
  })

  // 自分が関連するイベント取得
  .get("/mine", async (c) => {
    const events = await listMyEvents(c.get("db"), c.get("browserId"));
    return c.json(events, 200);
  })

  // イベント取得
  .get("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    const event = await getEvent(c.get("db"), c.get("browserId"), projectId);
    return c.json(event, 200);
  })

  // イベント編集。省略したフィールドは変えない
  .patch("/:projectId", zValidator("param", projectIdParamsSchema), zValidator("json", editReqSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    const event = await updateEvent(c.get("db"), c.get("browserId"), projectId, c.req.valid("json"));
    return c.json({ event }, 200);
  })

  // イベント削除
  .delete("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    await deleteEvent(c.get("db"), c.get("browserId"), projectId);
    return c.body(null, 204);
  })

  // 日程の提出。
  .post(
    "/:projectId/submissions",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      const guest = await submitAvailability(c.get("db"), c.get("browserId"), projectId, { name, comment, slots });
      return c.json({ guest }, 201);
    },
  )

  // 日程の更新。
  .put(
    "/:projectId/submissions/mine",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      const guest = await updateMyAvailability(c.get("db"), c.get("browserId"), projectId, { name, comment, slots });
      return c.json({ guest }, 200);
    },
  );

export default router;
