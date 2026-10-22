import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import type { z } from "zod";
import type { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import { type Db, insertMany, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";
import { nanoid } from "../lib/id.js";
import { ServiceError } from "./errors.js";
import { validateSlots } from "./slots.js";

export type CreateProjectInput = z.infer<typeof projectReqSchema>;
export type UpdateProjectInput = z.infer<typeof editReqSchema>;
export type SubmissionInput = z.infer<typeof submitReqSchema>;

/** DB には日時を ISO 8601 の文字列で入れる */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

export async function createProject(db: Db, browserId: string, input: CreateProjectInput) {
  const project = {
    id: nanoid(),
    name: input.name,
    description: input.description.trim() || null,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  await runBatch(db, [
    db.insert(schema.project).values(project),
    ...insertMany(
      db,
      schema.allowedRange,
      input.allowedRanges.map((range) => ({ ...range, eventId: project.id })),
    ),
    db.insert(schema.participant).values({ eventId: project.id, role: "host", browserId }),
    ...insertMany(
      db,
      schema.participationOption,
      input.participationOptions.map((opt) => ({
        id: opt.id,
        label: opt.label,
        color: opt.color,
        eventId: project.id,
      })),
    ),
  ]);

  return { id: project.id, name: project.name };
}

/** ホストまたはゲストとして関わるプロジェクト */
export async function listMyProjects(db: Db, browserId: string) {
  const projects = await db.query.project.findMany({
    where: inArray(
      schema.project.id,
      db
        .select({ id: schema.participant.eventId })
        .from(schema.participant)
        .where(eq(schema.participant.browserId, browserId)),
    ),
    with: {
      participants: {
        where: eq(schema.participant.browserId, browserId),
        columns: { role: true },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    startDate: p.startDate,
    endDate: p.endDate,
    timezone: p.timezone,
    isHost: p.participants.some((me) => me.role === "host"),
  }));
}

/** プロジェクトの詳細。URL (プロジェクト ID) を知っていれば誰でも見られる。 */
export async function getProject(db: Db, browserId: string, projectId: string) {
  const project = await db.query.project.findFirst({
    where: eq(schema.project.id, projectId),
    with: {
      allowedRanges: true,
      participationOptions: true,
      participants: {
        with: {
          slots: true,
        },
      },
    },
  });

  if (!project) {
    throw new ServiceError("project_not_found", "イベントが見つかりません。");
  }

  const me = project.participants.find((p) => p.browserId === browserId);

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: project.startDate,
    endDate: project.endDate,
    timezone: project.timezone,
    allowedRanges: project.allowedRanges,
    participationOptions: project.participationOptions,
    hosts: project.participants.filter((p) => p.role === "host").map((p) => ({ id: p.id, eventId: p.eventId })),
    guests: project.participants.filter(hasAnswered).map(toGuest),
    isHost: me?.role === "host",
    meAsGuest: me && hasAnswered(me) ? toGuest(me) : null,
  };
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

async function isHost(db: Db, browserId: string, projectId: string) {
  const host = await db.query.participant.findFirst({
    where: and(
      eq(schema.participant.eventId, projectId),
      eq(schema.participant.browserId, browserId),
      eq(schema.participant.role, "host"),
    ),
    columns: { id: true },
  });
  return host !== undefined;
}

export async function updateProject(db: Db, browserId: string, projectId: string, input: UpdateProjectInput) {
  const [host, existingGuest] = await Promise.all([
    isHost(db, browserId, projectId),
    db.query.participant.findFirst({
      where: and(eq(schema.participant.eventId, projectId), isNotNull(schema.participant.name)),
      columns: { id: true },
    }),
  ]);

  if (!host) {
    throw new ServiceError("not_host", "アクセス権限がありません。");
  }

  const statements: Parameters<typeof runBatch>[1] = [];

  // 参加形態の更新
  if (input.participationOptions) {
    if (input.participationOptions.length === 0) {
      throw new ServiceError("options_empty", "参加形態は最低1つ必要です。");
    }

    // 削除対象の参加形態に Slot が紐づいているかチェック
    const existingOptions = await db.query.participationOption.findMany({
      where: eq(schema.participationOption.eventId, projectId),
      with: { slots: { columns: { id: true } } },
    });
    const newOptionIds = input.participationOptions.map((o) => o.id);
    const optionsToDelete = existingOptions.filter((o) => !newOptionIds.includes(o.id));
    const undeletableOptions = optionsToDelete.filter((o) => o.slots.length > 0);
    if (undeletableOptions.length > 0) {
      const labels = undeletableOptions.map((o) => o.label).join(", ");
      throw new ServiceError("option_in_use", `以下の参加形態は日程が登録されているため削除できません: ${labels}`);
    }

    statements.push(
      // 既存の参加形態で、新しいリストにないものを削除
      db
        .delete(schema.participationOption)
        .where(
          and(
            eq(schema.participationOption.eventId, projectId),
            notInArray(schema.participationOption.id, newOptionIds),
          ),
        ),
      // 既存の参加形態を更新または新規作成
      ...input.participationOptions.map((opt) =>
        db
          .insert(schema.participationOption)
          .values({ id: opt.id, label: opt.label, color: opt.color, eventId: projectId })
          .onConflictDoUpdate({
            target: schema.participationOption.id,
            set: { label: opt.label, color: opt.color },
          }),
      ),
    );
  }

  // 省略したフィールドは変えない。ゲストの回答があれば、日程と時間帯は変えない
  const projectFields = {
    name: input.name,
    description: input.description === undefined ? undefined : input.description.trim() || null,
    startDate: existingGuest ? undefined : input.startDate,
    endDate: existingGuest ? undefined : input.endDate,
  };
  // Drizzle は undefined の列を更新しないが、更新する列が 1 つも無いとエラーにする
  if (Object.values(projectFields).some((value) => value !== undefined)) {
    statements.push(db.update(schema.project).set(projectFields).where(eq(schema.project.id, projectId)));
  }
  if (!existingGuest && input.allowedRanges) {
    statements.push(
      db.delete(schema.allowedRange).where(eq(schema.allowedRange.eventId, projectId)),
      ...insertMany(
        db,
        schema.allowedRange,
        input.allowedRanges.map((range) => ({ ...range, eventId: projectId })),
      ),
    );
  }

  await runBatch(db, statements);

  return db.query.project.findFirst({
    where: eq(schema.project.id, projectId),
    columns: { id: true, name: true, description: true, startDate: true, endDate: true },
    with: { allowedRanges: true, participationOptions: true },
  });
}

export async function deleteProject(db: Db, browserId: string, projectId: string) {
  if (!(await isHost(db, browserId, projectId))) {
    throw new ServiceError("not_host", "削除権限がありません。");
  }

  await db.delete(schema.project).where(eq(schema.project.id, projectId));
}

/** Slot の検証に必要な分だけプロジェクトを読む */
async function findProjectForSlots(db: Db, projectId: string) {
  const project = await db.query.project.findFirst({
    where: eq(schema.project.id, projectId),
    columns: { timezone: true, startDate: true, endDate: true },
    with: {
      allowedRanges: { columns: { startTime: true, endTime: true } },
      participationOptions: { columns: { id: true } },
    },
  });
  if (!project) {
    throw new ServiceError("project_not_found", "イベントが見つかりません。");
  }
  return {
    timezone: project.timezone,
    startDate: project.startDate,
    endDate: project.endDate,
    allowedRanges: project.allowedRanges,
    participationOptions: project.participationOptions,
  };
}

function findMyParticipant(db: Db, browserId: string, projectId: string) {
  return db.query.participant.findFirst({
    where: and(eq(schema.participant.browserId, browserId), eq(schema.participant.eventId, projectId)),
    with: { slots: true },
  });
}

/** 自分の回答。回答していなければ null */
async function findMyGuest(db: Db, browserId: string, projectId: string) {
  const me = await findMyParticipant(db, browserId, projectId);
  return me && hasAnswered(me) ? toGuest(me) : null;
}

function slotRows(input: SubmissionInput, projectId: string, participantId: string) {
  return input.slots.map((slot) => ({
    startAt: toIso(slot.startAt),
    endAt: toIso(slot.endAt),
    eventId: projectId,
    participantId,
    optionId: slot.optionId,
  }));
}

export async function submitAvailability(db: Db, browserId: string, projectId: string, input: SubmissionInput) {
  // ホストはイベントを作った時点で participant があり、名前を入れると回答したことになる
  const me = await findMyParticipant(db, browserId, projectId);
  if (me && hasAnswered(me)) {
    throw new ServiceError("already_submitted", "提出済みです。");
  }

  validateSlots(await findProjectForSlots(db, projectId), input.slots);

  const answer = { name: input.name, comment: input.comment?.trim() || null };
  const participantId = me?.id ?? crypto.randomUUID();
  await runBatch(db, [
    me
      ? db.update(schema.participant).set(answer).where(eq(schema.participant.id, me.id))
      : db
          .insert(schema.participant)
          .values({ id: participantId, eventId: projectId, role: "guest", browserId, ...answer }),
    ...insertMany(db, schema.slot, slotRows(input, projectId, participantId)),
  ]);

  return findMyGuest(db, browserId, projectId);
}

export async function updateMyAvailability(db: Db, browserId: string, projectId: string, input: SubmissionInput) {
  const myGuest = await findMyGuest(db, browserId, projectId);

  if (!myGuest) {
    throw new ServiceError("submission_not_found", "既存の日程が見つかりません。");
  }

  validateSlots(await findProjectForSlots(db, projectId), input.slots);

  await runBatch(db, [
    db.delete(schema.slot).where(eq(schema.slot.participantId, myGuest.id)),
    ...insertMany(db, schema.slot, slotRows(input, projectId, myGuest.id)),
    db
      .update(schema.participant)
      .set({ name: input.name, comment: input.comment?.trim() || null })
      .where(eq(schema.participant.id, myGuest.id)),
  ]);

  return findMyGuest(db, browserId, projectId);
}
