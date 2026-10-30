import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { ServiceError } from "./errors.js";
import { recreateAnswer, replaceAnswer, updateEvent } from "./events.js";
import { type Actor, canDeleteParticipant, canEditEvent, canEditParticipant } from "./permissions.js";
import type { EventSnapshot, ParticipantSnapshot } from "./snapshots.js";

/** 一覧に出す履歴の上限 */
const HISTORY_LIMIT = 100;

/** イベントの変更の履歴。新しい順。URL を知っていれば誰でも見られる */
export async function listHistory(db: Db, actor: Actor, eventId: string) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, deletedAt: true, ownerUserId: true },
    with: {
      participants: { columns: { id: true, userId: true } },
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

  const participants = new Map(event.participants.map((p) => [p.id, p]));
  return event.histories.map((h) => {
    // 回答の持ち主 (userId) は返さない
    const { userId: _, ...before } = h.before as ParticipantSnapshot;
    return {
      id: h.id,
      target: h.target,
      targetId: h.targetId,
      action: h.action,
      before: h.target === "event" ? h.before : before,
      createdAt: h.createdAt,
      canRestore:
        h.target === "event"
          ? canEditEvent(actor, event)
          : canRestoreParticipant(actor, event, participants.get(h.targetId), h.before as ParticipantSnapshot),
    };
  });
}

/**
 * 回答の履歴を戻せるか。残っている回答なら、変えられる人。消した回答なら、消せる人 (消した時の持ち主で判定する)。
 */
function canRestoreParticipant(
  actor: Actor,
  event: { ownerUserId: string | null },
  current: { userId: string | null } | undefined,
  before: ParticipantSnapshot,
) {
  if (current) return canEditParticipant(actor, event, current);
  return canDeleteParticipant(actor, event, { userId: before.userId ?? null });
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

  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { ownerUserId: true },
  });
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  const before = history.before as ParticipantSnapshot;
  const participant = await db.query.participant.findFirst({
    where: and(eq(schema.participant.id, history.targetId), eq(schema.participant.eventId, eventId)),
    with: { slots: true },
  });
  if (!canRestoreParticipant(actor, event, participant, before)) {
    throw new ServiceError("forbidden", "この回答を戻す権限がありません。");
  }
  const input = {
    name: before.name,
    comment: before.comment,
    slots: before.slots.map((slot) => ({ ...slot, startAt: new Date(slot.startAt), endAt: new Date(slot.endAt) })),
  };
  if (participant) {
    await replaceAnswer(db, actor, eventId, participant, input);
  } else {
    await recreateAnswer(db, eventId, history.targetId, before.userId ?? null, input);
  }
}
