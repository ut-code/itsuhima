import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { editEventReqSchema, eventReqSchema, submitReqSchema } from "../../../common/validators.js";
import type { AppEnv } from "../env.js";
import { ID_PATTERN } from "../lib/id.js";
import { visitedMiddleware } from "../middleware/visited.js";
import {
  createEvent,
  deleteAvailability,
  deleteEvent,
  getEvent,
  listEventsByIds,
  restoreEvent,
  submitAvailability,
  updateAvailability,
  updateEvent,
} from "../services/events.js";
import { listHistory, restoreHistory } from "../services/history.js";

const eventIdParamsSchema = z.object({ eventId: z.string().length(21) });
const historyParamsSchema = eventIdParamsSchema.extend({ historyId: z.string().uuid() });
// 回答の id は UUID。前のデータ (Prisma で作った Guest の id) も含むので、形は確かめない
const participantParamsSchema = eventIdParamsSchema.extend({ participantId: z.string().min(1).max(64) });

/** 一度に引けるイベントの数 */
const MAX_EVENT_IDS = 100;

/** `?ids=a,b,c`。イベント ID の形でないものは捨てる */
const eventIdsQuerySchema = z.object({
  ids: z
    .string()
    .transform((ids) => [...new Set(ids.split(",").filter((id) => ID_PATTERN.test(id)))])
    .pipe(z.array(z.string()).max(MAX_EVENT_IDS)),
});

const router = new Hono<AppEnv>()
  // 書き込んだら (作成・編集・削除・戻す)、`/` から `/home` に飛ぶようにする
  .use("*", visitedMiddleware)
  // イベント作成
  .post("/", zValidator("json", eventReqSchema), async (c) => {
    const event = await createEvent(c.get("db"), c.get("actor"), c.req.valid("json"));
    // hasOwner: client は、匿名で作れたものだけを控える
    return c.json({ id: event.id, name: event.name, hasOwner: event.hasOwner }, 201);
  })

  // 指定した id のイベントの一覧 (名前・日程・削除したか)。client が控えた id から一覧を出すのに使う
  .get("/", zValidator("query", eventIdsQuerySchema), async (c) => {
    const events = await listEventsByIds(c.get("db"), c.req.valid("query").ids);
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

  // 削除したイベントを戻す
  .post("/:eventId/restore", zValidator("param", eventIdParamsSchema), async (c) => {
    const { eventId } = c.req.valid("param");
    await restoreEvent(c.get("db"), c.get("actor"), eventId);
    return c.body(null, 204);
  })

  // 変更の履歴 (新しい順)
  .get("/:eventId/history", zValidator("param", eventIdParamsSchema), async (c) => {
    const { eventId } = c.req.valid("param");
    const history = await listHistory(c.get("db"), c.get("actor"), eventId);
    return c.json(history, 200);
  })

  // 履歴の、変える前の状態に戻す
  .post("/:eventId/history/:historyId/restore", zValidator("param", historyParamsSchema), async (c) => {
    const { eventId, historyId } = c.req.valid("param");
    await restoreHistory(c.get("db"), c.get("actor"), eventId, historyId);
    return c.body(null, 204);
  })

  // 回答する
  .post(
    "/:eventId/participants",
    zValidator("param", eventIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { eventId } = c.req.valid("param");
      const participant = await submitAvailability(c.get("db"), c.get("actor"), eventId, c.req.valid("json"));
      return c.json({ participant }, 201);
    },
  )

  // 回答を変える
  .put(
    "/:eventId/participants/:participantId",
    zValidator("param", participantParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { eventId, participantId } = c.req.valid("param");
      const participant = await updateAvailability(
        c.get("db"),
        c.get("actor"),
        eventId,
        participantId,
        c.req.valid("json"),
      );
      return c.json({ participant }, 200);
    },
  )

  // 回答を消す。履歴から戻せる
  .delete("/:eventId/participants/:participantId", zValidator("param", participantParamsSchema), async (c) => {
    const { eventId, participantId } = c.req.valid("param");
    await deleteAvailability(c.get("db"), c.get("actor"), eventId, participantId);
    return c.body(null, 204);
  });

export default router;
