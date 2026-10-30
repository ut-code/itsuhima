import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { editEventReqSchema, eventReqSchema, submitReqSchema } from "../../../common/validators.js";
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

const eventIdParamsSchema = z.object({ eventId: z.string().length(21) });

const router = new Hono<AppEnv>()
  // イベント作成
  .post("/", zValidator("json", eventReqSchema), async (c) => {
    const event = await createEvent(c.get("db"), c.get("actor"), c.req.valid("json"));
    return c.json({ id: event.id, name: event.name }, 201);
  })

  // 自分が関連するイベント取得
  .get("/mine", async (c) => {
    const events = await listMyEvents(c.get("db"), c.get("actor"));
    return c.json(events, 200);
  })

  // イベント取得
  .get("/:eventId", zValidator("param", eventIdParamsSchema), async (c) => {
    const { eventId } = c.req.valid("param");
    const result = await getEvent(c.get("db"), c.get("actor"), eventId);
    if (result.status === "deleted") {
      // 削除されたイベントのページに、名前と戻すボタンを出すのに使う
      return c.json({ message: "このイベントは削除されました。", ...result.event }, 410);
    }
    return c.json(result.event, 200);
  })

  // イベント編集。省略したフィールドは変えない
  .patch("/:eventId", zValidator("param", eventIdParamsSchema), zValidator("json", editEventReqSchema), async (c) => {
    const { eventId } = c.req.valid("param");
    const event = await updateEvent(c.get("db"), c.get("actor"), eventId, c.req.valid("json"));
    return c.json({ event }, 200);
  })

  // イベント削除 (論理削除)
  .delete("/:eventId", zValidator("param", eventIdParamsSchema), async (c) => {
    const { eventId } = c.req.valid("param");
    await deleteEvent(c.get("db"), c.get("actor"), eventId);
    return c.body(null, 204);
  })

  // 日程の提出。
  .post(
    "/:eventId/submissions",
    zValidator("param", eventIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { eventId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      const guest = await submitAvailability(c.get("db"), c.get("actor"), eventId, { name, comment, slots });
      return c.json({ guest }, 201);
    },
  )

  // 日程の更新。
  .put(
    "/:eventId/submissions/mine",
    zValidator("param", eventIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { eventId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      const guest = await updateMyAvailability(c.get("db"), c.get("actor"), eventId, { name, comment, slots });
      return c.json({ guest }, 200);
    },
  );

export default router;
