import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { ServiceError } from "./errors.js";
import { recreateAnswer, replaceAnswer, updateEvent } from "./events.js";
import { type Actor, canEditEvent, canEditParticipant } from "./permissions.js";
import type { EventSnapshot, ParticipantSnapshot } from "./snapshots.js";

/** 一覧に出す履歴の上限 */
const HISTORY_LIMIT = 100;

/** イベントの変更の履歴。新しい順。URL を知っていれば誰でも見られる */
export async function listHistory(db: Db, actor: Actor, eventId: string) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, deletedAt: true },
    with: {
      histories: {
        // 同じ時刻のものは、後に足したものを先にする
        orderBy: [desc(schema.history.createdAt), desc(sql`rowid`)],
        limit: HISTORY_LIMIT,
      },
    },
  });
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  if (event.deletedAt !== null) {
    throw new ServiceError("event_deleted", "このイベントは削除されています。");
  }

  return event.histories.map((h) => ({
    id: h.id,
    target: h.target,
    targetId: h.targetId,
    action: h.action,
    before: h.before,
    createdAt: h.createdAt,
    canRestore:
      h.target === "event" ? canEditEvent(actor, event) : canEditParticipant(actor, event, { id: h.targetId }),
  }));
}

/**
 * 履歴の、変える前の状態に戻す。戻す前の状態も履歴に残るので、戻したこと自体も取り消せる。
 * 消した回答は、同じ id で作り直す。戻せる人は、その対象を編集できる人と同じ。
 */
export async function restoreHistory(db: Db, actor: Actor, eventId: string, historyId: string) {
  const history = await db.query.history.findFirst({
    where: and(eq(schema.history.id, historyId), eq(schema.history.eventId, eventId)),
  });
  if (!history) {
    throw new ServiceError("history_not_found", "履歴が見つかりません。");
  }

  if (history.target === "event") {
    await updateEvent(db, actor, eventId, history.before as EventSnapshot);
    return;
  }

  if (!canEditParticipant(actor, { id: eventId }, { id: history.targetId })) {
    throw new ServiceError("forbidden", "この回答を戻す権限がありません。");
  }
  const before = history.before as ParticipantSnapshot;
  const input = {
    name: before.name,
    comment: before.comment,
    slots: before.slots.map((slot) => ({ ...slot, startAt: new Date(slot.startAt), endAt: new Date(slot.endAt) })),
  };
  const participant = await db.query.participant.findFirst({
    where: and(eq(schema.participant.id, history.targetId), eq(schema.participant.eventId, eventId)),
    with: { slots: true },
  });
  if (participant) {
    await replaceAnswer(db, eventId, participant, input);
  } else {
    await recreateAnswer(db, eventId, history.targetId, input);
  }
}
