import { and, eq, inArray, isNull, lte, notInArray } from "drizzle-orm";
import type { z } from "zod";
import type { editEventReqSchema, eventReqSchema, submitReqSchema } from "../../../common/validators.js";
import { type Db, insertMany, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";
import { nanoid } from "../lib/id.js";
import { ServiceError } from "./errors.js";
import { type Actor, canEditEvent, canEditParticipant } from "./permissions.js";
import { validateSlots } from "./slots.js";
import { eventSnapshot, insertHistory, isSameSnapshot, participantSnapshot } from "./snapshots.js";

export type CreateEventInput = z.infer<typeof eventReqSchema>;
export type UpdateEventInput = z.infer<typeof editEventReqSchema>;
export type SubmissionInput = z.infer<typeof submitReqSchema>;

/** 論理削除したイベントを、行ごと消すまでの日数 */
export const DELETED_EVENT_RETENTION_DAYS = 7;

/** DB には日時を ISO 8601 の文字列で入れる */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

export async function createEvent(db: Db, _actor: Actor, input: CreateEventInput) {
  const event = {
    id: nanoid(),
    name: input.name,
    description: input.description.trim() || null,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  await runBatch(db, [
    db.insert(schema.event).values(event),
    ...insertMany(
      db,
      schema.allowedRange,
      input.allowedRanges.map((range) => ({ ...range, eventId: event.id })),
    ),
    ...insertMany(
      db,
      schema.option,
      input.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        color: opt.color,
        eventId: event.id,
      })),
    ),
  ]);

  return { id: event.id, name: event.name };
}

/**
 * 指定した id のイベントの、一覧に出す分の情報。client が localStorage に控えた id から一覧を出すのに使う。
 * 無い id は返さない (client は控えから外す)。削除したイベントは deleted を true にして返す。
 */
export async function listEventsByIds(db: Db, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const events = await db.query.event.findMany({
    where: inArray(schema.event.id, eventIds),
    columns: { id: true, name: true, startDate: true, endDate: true, timezone: true, deletedAt: true },
  });
  return events.map(({ deletedAt, ...event }) => ({ ...event, deleted: deletedAt !== null }));
}

/**
 * イベントの詳細。URL (イベント ID) を知っていれば誰でも見られる。
 * 削除したイベントは、名前と、いつ完全に消えるかだけを返す (回答者の名前などは返さない)。
 */
export async function getEvent(db: Db, actor: Actor, eventId: string) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    with: {
      allowedRanges: true,
      options: true,
      participants: {
        with: {
          slots: true,
        },
      },
    },
  });

  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }

  if (event.deletedAt !== null) {
    const purgeAt = new Date(event.deletedAt);
    purgeAt.setUTCDate(purgeAt.getUTCDate() + DELETED_EVENT_RETENTION_DAYS);
    return {
      status: "deleted" as const,
      event: {
        id: event.id,
        name: event.name,
        deletedAt: event.deletedAt,
        purgeAt: purgeAt.toISOString(),
        canRestore: canEditEvent(actor, event),
      },
    };
  }

  return {
    status: "active" as const,
    event: {
      id: event.id,
      name: event.name,
      description: event.description ?? "",
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
      allowedRanges: event.allowedRanges,
      options: event.options,
      participants: event.participants.map((participant) => ({
        ...toParticipantResponse(participant),
        canEdit: canEditParticipant(actor, event, participant),
      })),
      canEdit: canEditEvent(actor, event),
    },
  };
}

/** リンクのプレビュー (OG) に出す、イベントの名前と日程。無いか、削除したものなら null (汎用の OG を出す) */
export async function getEventPreview(db: Db, eventId: string) {
  const event = await db.query.event.findFirst({
    where: and(eq(schema.event.id, eventId), isNull(schema.event.deletedAt)),
    columns: { id: true, name: true, startDate: true, endDate: true },
  });
  return event ?? null;
}

type ParticipantWithSlots = typeof schema.participant.$inferSelect & { slots: (typeof schema.slot.$inferSelect)[] };

function toParticipantResponse(participant: ParticipantWithSlots) {
  return {
    id: participant.id,
    name: participant.name,
    comment: participant.comment,
    eventId: participant.eventId,
    slots: participant.slots,
  };
}

/** 権限の判定に要る分だけイベントを読む */
function findEventForPermission(db: Db, eventId: string) {
  return db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, deletedAt: true },
  });
}

function throwIfDeleted(event: { deletedAt: string | null }) {
  if (event.deletedAt !== null) {
    throw new ServiceError("event_deleted", "このイベントは削除されています。");
  }
}

export async function updateEvent(db: Db, actor: Actor, eventId: string, input: UpdateEventInput) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    with: {
      allowedRanges: true,
      options: { with: { slots: { columns: { id: true }, limit: 1 } } },
      participants: { columns: { id: true }, limit: 1 },
    },
  });

  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  if (!canEditEvent(actor, event)) {
    throw new ServiceError("forbidden", "このイベントを編集する権限がありません。");
  }
  throwIfDeleted(event);
  const answered = event.participants.length > 0;

  const statements: Parameters<typeof runBatch>[1] = [];

  // 参加形態の更新
  if (input.options) {
    if (input.options.length === 0) {
      throw new ServiceError("options_empty", "参加形態は最低1つ必要です。");
    }

    // 削除対象の参加形態に Slot が紐づいているかチェック
    const newOptionIds = input.options.map((o) => o.id);
    const optionsToDelete = event.options.filter((o) => !newOptionIds.includes(o.id));
    const undeletableOptions = optionsToDelete.filter((o) => o.slots.length > 0);
    if (undeletableOptions.length > 0) {
      const labels = undeletableOptions.map((o) => o.label).join(", ");
      throw new ServiceError("option_in_use", `以下の参加形態は日程が登録されているため削除できません: ${labels}`);
    }

    statements.push(
      // 既存の参加形態で、新しいリストにないものを削除
      db
        .delete(schema.option)
        .where(and(eq(schema.option.eventId, eventId), notInArray(schema.option.id, newOptionIds))),
      // 既存の参加形態を更新または新規作成
      ...input.options.map((opt) =>
        db
          .insert(schema.option)
          .values({ id: opt.id, label: opt.label, color: opt.color, eventId })
          .onConflictDoUpdate({
            target: schema.option.id,
            set: { label: opt.label, color: opt.color },
          }),
      ),
    );
  }

  // 省略したフィールドは変えない。回答があれば、日程と時間帯は変えない
  const eventFields = {
    name: input.name,
    description: input.description === undefined ? undefined : input.description.trim() || null,
    startDate: answered ? undefined : input.startDate,
    endDate: answered ? undefined : input.endDate,
  };
  // Drizzle は undefined の列を更新しないが、更新する列が 1 つも無いとエラーにする
  if (Object.values(eventFields).some((value) => value !== undefined)) {
    statements.push(db.update(schema.event).set(eventFields).where(eq(schema.event.id, eventId)));
  }
  if (!answered && input.allowedRanges) {
    statements.push(
      db.delete(schema.allowedRange).where(eq(schema.allowedRange.eventId, eventId)),
      ...insertMany(
        db,
        schema.allowedRange,
        input.allowedRanges.map((range) => ({ ...range, eventId })),
      ),
    );
  }

  // 変える前の設定を履歴に残す。何も変わらなければ残さない
  const before = eventSnapshot(event);
  const after = eventSnapshot({
    name: eventFields.name ?? event.name,
    description: eventFields.description === undefined ? event.description : eventFields.description,
    startDate: eventFields.startDate ?? event.startDate,
    endDate: eventFields.endDate ?? event.endDate,
    allowedRanges: (!answered && input.allowedRanges) || event.allowedRanges,
    options: input.options ?? event.options,
  });
  if (!isSameSnapshot(before, after)) {
    statements.unshift(insertHistory(db, { eventId, target: "event", targetId: eventId, action: "update", before }));
  }

  await runBatch(db, statements);

  return db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, name: true, description: true, startDate: true, endDate: true },
    with: { allowedRanges: true, options: true },
  });
}

/** 論理削除する。行は、DELETED_EVENT_RETENTION_DAYS 日たってから消す。削除済みなら何もしない */
export async function deleteEvent(db: Db, actor: Actor, eventId: string) {
  const event = await findEventForPermission(db, eventId);
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  if (!canEditEvent(actor, event)) {
    throw new ServiceError("forbidden", "このイベントを削除する権限がありません。");
  }

  await db
    .update(schema.event)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(schema.event.id, eventId), isNull(schema.event.deletedAt)));
}

/** 論理削除したイベントを戻す。削除されていなければ何もしない */
export async function restoreEvent(db: Db, actor: Actor, eventId: string) {
  const event = await findEventForPermission(db, eventId);
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  if (!canEditEvent(actor, event)) {
    throw new ServiceError("forbidden", "このイベントを戻す権限がありません。");
  }

  await db.update(schema.event).set({ deletedAt: null }).where(eq(schema.event.id, eventId));
}

/** 論理削除してから DELETED_EVENT_RETENTION_DAYS 日たったイベントを、行ごと消す (回答や履歴も CASCADE で消える) */
export async function purgeDeletedEvents(db: Db, now = new Date()) {
  const threshold = new Date(now);
  threshold.setUTCDate(threshold.getUTCDate() - DELETED_EVENT_RETENTION_DAYS);
  await db.delete(schema.event).where(lte(schema.event.deletedAt, threshold.toISOString()));
}

/** Slot の検証に必要な分だけイベントを読む */
async function findEventForSlots(db: Db, eventId: string) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { timezone: true, startDate: true, endDate: true, deletedAt: true },
    with: {
      allowedRanges: { columns: { startTime: true, endTime: true } },
      options: { columns: { id: true } },
    },
  });
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  throwIfDeleted(event);
  return {
    timezone: event.timezone,
    startDate: event.startDate,
    endDate: event.endDate,
    allowedRanges: event.allowedRanges,
    options: event.options,
  };
}

/** イベントの回答。無いか、ほかのイベントの回答なら投げる */
async function findParticipant(db: Db, eventId: string, participantId: string) {
  const participant = await db.query.participant.findFirst({
    where: and(eq(schema.participant.id, participantId), eq(schema.participant.eventId, eventId)),
    with: { slots: true },
  });
  if (!participant) {
    throw new ServiceError("participant_not_found", "回答が見つかりません。");
  }
  return participant;
}

/** 回答と、その権限 (イベントの一覧の canEdit と同じ) */
async function findParticipantResponse(db: Db, actor: Actor, eventId: string, participantId: string) {
  const participant = await findParticipant(db, eventId, participantId);
  return {
    ...toParticipantResponse(participant),
    canEdit: canEditParticipant(actor, { id: eventId }, participant),
  };
}

function slotRows(input: SubmissionInput, eventId: string, participantId: string) {
  return input.slots.map((slot) => ({
    startAt: toIso(slot.startAt),
    endAt: toIso(slot.endAt),
    eventId,
    participantId,
    optionId: slot.optionId,
  }));
}

/** 回答を足す。名前の重複は許す */
export async function submitAvailability(db: Db, actor: Actor, eventId: string, input: SubmissionInput) {
  validateSlots(await findEventForSlots(db, eventId), input.slots);

  const participantId = crypto.randomUUID();
  await runBatch(db, [
    db.insert(schema.participant).values({
      id: participantId,
      eventId,
      name: input.name,
      comment: input.comment?.trim() || null,
    }),
    ...insertMany(db, schema.slot, slotRows(input, eventId, participantId)),
  ]);

  return findParticipantResponse(db, actor, eventId, participantId);
}

export async function updateAvailability(
  db: Db,
  actor: Actor,
  eventId: string,
  participantId: string,
  input: SubmissionInput,
) {
  const participant = await findParticipant(db, eventId, participantId);
  if (!canEditParticipant(actor, { id: eventId }, participant)) {
    throw new ServiceError("forbidden", "この回答を編集する権限がありません。");
  }

  await replaceAnswer(db, eventId, participant, input);

  return findParticipantResponse(db, actor, eventId, participantId);
}

/** 回答を消す。消す前の回答を履歴に残すので、履歴から戻せる */
export async function deleteAvailability(db: Db, actor: Actor, eventId: string, participantId: string) {
  const event = await findEventForPermission(db, eventId);
  if (!event) {
    throw new ServiceError("event_not_found", "イベントが見つかりません。");
  }
  throwIfDeleted(event);
  const participant = await findParticipant(db, eventId, participantId);
  if (!canEditParticipant(actor, event, participant)) {
    throw new ServiceError("forbidden", "この回答を削除する権限がありません。");
  }

  await runBatch(db, [
    insertHistory(db, {
      eventId,
      target: "participant",
      targetId: participant.id,
      action: "delete",
      before: participantSnapshot(participant),
    }),
    // Slot は ON DELETE CASCADE で消える
    db
      .delete(schema.participant)
      .where(eq(schema.participant.id, participant.id)),
  ]);
}

/**
 * 回答の名前・コメント・Slot を置き換える。変える前の回答を履歴に残す (何も変わらなければ残さない)。
 * 権限は呼び出す側で確かめる。
 */
export async function replaceAnswer(
  db: Db,
  eventId: string,
  participant: ParticipantWithSlots,
  input: SubmissionInput,
) {
  validateSlots(await findEventForSlots(db, eventId), input.slots);

  const answer = { name: input.name, comment: input.comment?.trim() || null };
  const rows = slotRows(input, eventId, participant.id);
  const before = participantSnapshot(participant);
  const changed = !isSameSnapshot(before, participantSnapshot({ ...answer, slots: rows }));

  await runBatch(db, [
    ...(changed
      ? [insertHistory(db, { eventId, target: "participant", targetId: participant.id, action: "update", before })]
      : []),
    db.delete(schema.slot).where(eq(schema.slot.participantId, participant.id)),
    ...insertMany(db, schema.slot, rows),
    db.update(schema.participant).set(answer).where(eq(schema.participant.id, participant.id)),
  ]);
}

/**
 * 消した回答を、同じ id で作り直す。履歴から戻すのに使う。権限は呼び出す側で確かめる。
 */
export async function recreateAnswer(db: Db, eventId: string, participantId: string, input: SubmissionInput) {
  validateSlots(await findEventForSlots(db, eventId), input.slots);

  await runBatch(db, [
    db.insert(schema.participant).values({
      id: participantId,
      eventId,
      name: input.name,
      comment: input.comment?.trim() || null,
    }),
    ...insertMany(db, schema.slot, slotRows(input, eventId, participantId)),
  ]);
}
