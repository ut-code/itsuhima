import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";
import type { z } from "zod";
import type { editEventReqSchema, eventReqSchema, submitReqSchema } from "../../../common/validators.js";
import { type Db, insertMany, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";
import { nanoid } from "../lib/id.js";
import { ServiceError } from "./errors.js";
import { type Actor, canEditEvent } from "./permissions.js";
import { validateSlots } from "./slots.js";

export type CreateEventInput = z.infer<typeof eventReqSchema>;
export type UpdateEventInput = z.infer<typeof editEventReqSchema>;
export type SubmissionInput = z.infer<typeof submitReqSchema>;

/** 論理削除したイベントを、行ごと消すまでの日数 */
export const DELETED_EVENT_RETENTION_DAYS = 7;

/** DB には日時を ISO 8601 の文字列で入れる */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

export async function createEvent(db: Db, actor: Actor, input: CreateEventInput) {
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
    db.insert(schema.participant).values({ eventId: event.id, role: "host", browserId: actor.browserId }),
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

/** ホストまたはゲストとして関わるイベント。削除したものは除く */
export async function listMyEvents(db: Db, actor: Actor) {
  const events = await db.query.event.findMany({
    where: and(
      inArray(
        schema.event.id,
        db
          .select({ id: schema.participant.eventId })
          .from(schema.participant)
          .where(eq(schema.participant.browserId, actor.browserId)),
      ),
      isNull(schema.event.deletedAt),
    ),
    with: {
      participants: {
        where: eq(schema.participant.browserId, actor.browserId),
        columns: { role: true },
      },
    },
  });

  return events.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    startDate: p.startDate,
    endDate: p.endDate,
    timezone: p.timezone,
    isHost: p.participants.some((me) => me.role === "host"),
  }));
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

  const me = event.participants.find((p) => p.browserId === actor.browserId);

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
      hosts: event.participants.filter((p) => p.role === "host").map((p) => ({ id: p.id, eventId: p.eventId })),
      guests: event.participants.filter(hasAnswered).map(toGuest),
      isHost: canEditEvent(actor, event),
      meAsGuest: me && hasAnswered(me) ? toGuest(me) : null,
    },
  };
}

/** リンクのプレビュー (OG) に出す、イベントの名前と日程。無ければ null */
export async function getEventPreview(db: Db, eventId: string) {
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, name: true, startDate: true, endDate: true },
  });
  return event ?? null;
}

type ParticipantWithSlots = typeof schema.participant.$inferSelect & { slots: (typeof schema.slot.$inferSelect)[] };

/** 回答したか。name が null なら、まだ回答していない (イベントを作っただけのホスト) */
function hasAnswered<T extends { name: string | null }>(participant: T): participant is T & { name: string } {
  return participant.name !== null;
}

/** API では、回答した参加者を guest として返す。Slot の participantId は guestId として返す */
function toGuest(participant: ParticipantWithSlots & { name: string }) {
  return {
    id: participant.id,
    name: participant.name,
    comment: participant.comment,
    eventId: participant.eventId,
    slots: participant.slots.map(({ participantId, ...slot }) => ({ ...slot, guestId: participantId })),
  };
}

/** 権限の判定に要る分だけイベントを読む */
function findEventForPermission(db: Db, eventId: string) {
  return db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    columns: { id: true, deletedAt: true },
    with: { participants: { columns: { role: true, browserId: true } } },
  });
}

function throwIfDeleted(event: { deletedAt: string | null }) {
  if (event.deletedAt !== null) {
    throw new ServiceError("event_deleted", "このイベントは削除されています。");
  }
}

export async function updateEvent(db: Db, actor: Actor, eventId: string, input: UpdateEventInput) {
  const [event, existingGuest] = await Promise.all([
    findEventForPermission(db, eventId),
    db.query.participant.findFirst({
      where: and(eq(schema.participant.eventId, eventId), isNotNull(schema.participant.name)),
      columns: { id: true },
    }),
  ]);

  if (!event || !canEditEvent(actor, event)) {
    throw new ServiceError("not_host", "アクセス権限がありません。");
  }
  throwIfDeleted(event);

  const statements: Parameters<typeof runBatch>[1] = [];

  // 参加形態の更新
  if (input.options) {
    if (input.options.length === 0) {
      throw new ServiceError("options_empty", "参加形態は最低1つ必要です。");
    }

    // 削除対象の参加形態に Slot が紐づいているかチェック
    const existingOptions = await db.query.option.findMany({
      where: eq(schema.option.eventId, eventId),
      with: { slots: { columns: { id: true } } },
    });
    const newOptionIds = input.options.map((o) => o.id);
    const optionsToDelete = existingOptions.filter((o) => !newOptionIds.includes(o.id));
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

  // 省略したフィールドは変えない。ゲストの回答があれば、日程と時間帯は変えない
  const eventFields = {
    name: input.name,
    description: input.description === undefined ? undefined : input.description.trim() || null,
    startDate: existingGuest ? undefined : input.startDate,
    endDate: existingGuest ? undefined : input.endDate,
  };
  // Drizzle は undefined の列を更新しないが、更新する列が 1 つも無いとエラーにする
  if (Object.values(eventFields).some((value) => value !== undefined)) {
    statements.push(db.update(schema.event).set(eventFields).where(eq(schema.event.id, eventId)));
  }
  if (!existingGuest && input.allowedRanges) {
    statements.push(
      db.delete(schema.allowedRange).where(eq(schema.allowedRange.eventId, eventId)),
      ...insertMany(
        db,
        schema.allowedRange,
        input.allowedRanges.map((range) => ({ ...range, eventId })),
      ),
    );
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
  if (!event || !canEditEvent(actor, event)) {
    throw new ServiceError("not_host", "削除権限がありません。");
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
    throw new ServiceError("not_host", "戻す権限がありません。");
  }

  await db.update(schema.event).set({ deletedAt: null }).where(eq(schema.event.id, eventId));
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

function findMyParticipant(db: Db, actor: Actor, eventId: string) {
  return db.query.participant.findFirst({
    where: and(eq(schema.participant.browserId, actor.browserId), eq(schema.participant.eventId, eventId)),
    with: { slots: true },
  });
}

/** 自分の回答。回答していなければ null */
async function findMyGuest(db: Db, actor: Actor, eventId: string) {
  const me = await findMyParticipant(db, actor, eventId);
  return me && hasAnswered(me) ? toGuest(me) : null;
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

export async function submitAvailability(db: Db, actor: Actor, eventId: string, input: SubmissionInput) {
  // ホストはイベントを作った時点で participant があり、名前を入れると回答したことになる
  const me = await findMyParticipant(db, actor, eventId);
  if (me && hasAnswered(me)) {
    throw new ServiceError("already_submitted", "提出済みです。");
  }

  validateSlots(await findEventForSlots(db, eventId), input.slots);

  const answer = { name: input.name, comment: input.comment?.trim() || null };
  const participantId = me?.id ?? crypto.randomUUID();
  await runBatch(db, [
    me
      ? db.update(schema.participant).set(answer).where(eq(schema.participant.id, me.id))
      : db
          .insert(schema.participant)
          .values({ id: participantId, eventId, role: "guest", browserId: actor.browserId, ...answer }),
    ...insertMany(db, schema.slot, slotRows(input, eventId, participantId)),
  ]);

  return findMyGuest(db, actor, eventId);
}

export async function updateMyAvailability(db: Db, actor: Actor, eventId: string, input: SubmissionInput) {
  const myGuest = await findMyGuest(db, actor, eventId);

  if (!myGuest) {
    throw new ServiceError("submission_not_found", "既存の日程が見つかりません。");
  }

  validateSlots(await findEventForSlots(db, eventId), input.slots);

  await runBatch(db, [
    db.delete(schema.slot).where(eq(schema.slot.participantId, myGuest.id)),
    ...insertMany(db, schema.slot, slotRows(input, eventId, myGuest.id)),
    db
      .update(schema.participant)
      .set({ name: input.name, comment: input.comment?.trim() || null })
      .where(eq(schema.participant.id, myGuest.id)),
  ]);

  return findMyGuest(db, actor, eventId);
}
