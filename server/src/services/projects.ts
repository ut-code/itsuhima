import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import type { z } from "zod";
import type { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import { type Db, insertMany, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";
import { nanoid } from "../lib/id.js";
import { formatMinutes, fromWallClock, wallClockIn } from "../lib/wallClock.js";
import { ServiceError } from "./errors.js";
import { validateSlots } from "./slots.js";

export type CreateProjectInput = z.infer<typeof projectReqSchema>;
export type UpdateProjectInput = z.infer<typeof editReqSchema>;
export type SubmissionInput = Omit<z.infer<typeof submitReqSchema>, "projectId">;

/** DB には日時を ISO 8601 の文字列で入れる */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

/** 時間帯は日付を持たず、timezone での時刻 ("HH:mm") で入れる */
function toTimeOfDay(value: string, timezone: string): string {
  return formatMinutes(wallClockIn(timezone)(new Date(value)).minutes);
}

/**
 * API では時間帯を ISO 8601 の日時で返す。Web UI が送るのと同じく、開始は初日、終了は最終日の日付にする。
 */
function allowedRangesResponse<T extends { startTime: string; endTime: string }>(
  project: { timezone: string; startDate: string; endDate: string },
  ranges: T[],
): T[] {
  const toWallClock = wallClockIn(project.timezone);
  const firstDate = toWallClock(new Date(project.startDate)).date;
  const lastDate = toWallClock(new Date(project.endDate)).date;
  return ranges.map((range) => ({
    ...range,
    startTime: fromWallClock(firstDate, range.startTime, project.timezone).toISOString(),
    endTime: fromWallClock(lastDate, range.endTime, project.timezone).toISOString(),
  }));
}

export async function createProject(db: Db, browserId: string, input: CreateProjectInput) {
  const project = {
    id: nanoid(),
    name: input.name,
    description: input.description.trim() || null,
    startDate: toIso(input.startDate),
    endDate: toIso(input.endDate),
    timezone: schema.DEFAULT_TIMEZONE,
  };

  await runBatch(db, [
    db.insert(schema.project).values(project),
    ...insertMany(
      db,
      schema.allowedRange,
      input.allowedRanges.map((range) => ({
        startTime: toTimeOfDay(range.startTime, project.timezone),
        endTime: toTimeOfDay(range.endTime, project.timezone),
        projectId: project.id,
      })),
    ),
    db.insert(schema.host).values({ browserId, projectId: project.id }),
    ...insertMany(
      db,
      schema.participationOption,
      input.participationOptions.map((opt) => ({
        id: opt.id,
        label: opt.label,
        color: opt.color,
        projectId: project.id,
      })),
    ),
  ]);

  return { id: project.id, name: project.name };
}

/** ホストまたはゲストとして関わるプロジェクト */
export async function listMyProjects(db: Db, browserId: string) {
  const projects = await db.query.project.findMany({
    where: or(
      inArray(
        schema.project.id,
        db.select({ id: schema.host.projectId }).from(schema.host).where(eq(schema.host.browserId, browserId)),
      ),
      inArray(
        schema.project.id,
        db.select({ id: schema.guest.projectId }).from(schema.guest).where(eq(schema.guest.browserId, browserId)),
      ),
    ),
    with: {
      hosts: {
        columns: { browserId: true },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    startDate: p.startDate,
    endDate: p.endDate,
    isHost: p.hosts.some((host) => host.browserId === browserId),
  }));
}

/** プロジェクトの詳細。URL (プロジェクト ID) を知っていれば誰でも見られる。 */
export async function getProject(db: Db, browserId: string, projectId: string) {
  const project = await db.query.project.findFirst({
    where: eq(schema.project.id, projectId),
    with: {
      allowedRanges: true,
      participationOptions: true,
      guests: {
        with: {
          slots: true,
        },
      },
      hosts: true,
    },
  });

  if (!project) {
    throw new ServiceError("project_not_found", "イベントが見つかりません。");
  }

  const guest = project.guests.find((g) => g.browserId === browserId);

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: project.startDate,
    endDate: project.endDate,
    allowedRanges: allowedRangesResponse(project, project.allowedRanges),
    participationOptions: project.participationOptions,
    hosts: project.hosts.map(omitBrowserId),
    guests: project.guests.map(omitBrowserId),
    isHost: project.hosts.some((h) => h.browserId === browserId),
    meAsGuest: guest ? omitBrowserId(guest) : null,
  };
}

function omitBrowserId<T extends { browserId: string }>(entity: T): Omit<T, "browserId"> {
  const { browserId: _, ...rest } = entity;
  return rest;
}

export async function updateProject(db: Db, browserId: string, projectId: string, input: UpdateProjectInput) {
  const [host, existingGuest, project] = await Promise.all([
    db.query.host.findFirst({
      where: and(eq(schema.host.browserId, browserId), eq(schema.host.projectId, projectId)),
    }),
    db.query.guest.findFirst({
      where: eq(schema.guest.projectId, projectId),
    }),
    db.query.project.findFirst({
      where: eq(schema.project.id, projectId),
      columns: { timezone: true },
    }),
  ]);

  if (!host || !project) {
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
      where: eq(schema.participationOption.projectId, projectId),
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
            eq(schema.participationOption.projectId, projectId),
            notInArray(schema.participationOption.id, newOptionIds),
          ),
        ),
      // 既存の参加形態を更新または新規作成
      ...input.participationOptions.map((opt) =>
        db
          .insert(schema.participationOption)
          .values({ id: opt.id, label: opt.label, color: opt.color, projectId })
          .onConflictDoUpdate({
            target: schema.participationOption.id,
            set: { label: opt.label, color: opt.color },
          }),
      ),
    );
  }

  // ゲストの回答があれば、日程と時間帯は変えない
  if (existingGuest) {
    statements.push(
      db
        .update(schema.project)
        .set({ name: input.name, description: input.description?.trim() || null })
        .where(eq(schema.project.id, projectId)),
    );
  } else {
    statements.push(
      db
        .update(schema.project)
        .set({
          name: input.name,
          description: input.description?.trim() || null,
          startDate: input.startDate ? toIso(input.startDate) : undefined,
          endDate: input.endDate ? toIso(input.endDate) : undefined,
        })
        .where(eq(schema.project.id, projectId)),
      db
        .delete(schema.allowedRange)
        .where(eq(schema.allowedRange.projectId, projectId)), // 既存削除
      ...insertMany(
        db,
        schema.allowedRange,
        (input.allowedRanges ?? []).map((r) => ({
          startTime: toTimeOfDay(r.startTime, project.timezone),
          endTime: toTimeOfDay(r.endTime, project.timezone),
          projectId,
        })),
      ),
    );
  }

  await runBatch(db, statements);

  const updated = await db.query.project.findFirst({
    where: eq(schema.project.id, projectId),
    columns: { id: true, name: true, description: true, startDate: true, endDate: true, timezone: true },
    with: { allowedRanges: true, participationOptions: true },
  });
  if (!updated) return undefined;
  const { timezone: _, ...rest } = updated;
  return { ...rest, allowedRanges: allowedRangesResponse(updated, updated.allowedRanges) };
}

export async function deleteProject(db: Db, browserId: string, projectId: string) {
  const host = await db.query.host.findFirst({
    where: and(eq(schema.host.browserId, browserId), eq(schema.host.projectId, projectId)),
  });

  if (!host) {
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
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    allowedRanges: project.allowedRanges,
    participationOptions: project.participationOptions,
  };
}

/** 自分の回答。呼び出し元がそのまま返せるよう、browserId は含めない */
function findGuest(db: Db, browserId: string, projectId: string) {
  return db.query.guest.findFirst({
    where: and(eq(schema.guest.browserId, browserId), eq(schema.guest.projectId, projectId)),
    columns: { browserId: false },
    with: { slots: true },
  });
}

function slotRows(input: SubmissionInput, projectId: string, guestId: string) {
  return input.slots.map((slot) => ({
    from: toIso(slot.start),
    to: toIso(slot.end),
    projectId,
    guestId,
    participationOptionId: slot.participationOptionId,
  }));
}

export async function submitAvailability(db: Db, browserId: string, projectId: string, input: SubmissionInput) {
  const existingGuest = await findGuest(db, browserId, projectId);
  if (existingGuest) {
    throw new ServiceError("already_submitted", "提出済みです。");
  }

  validateSlots(await findProjectForSlots(db, projectId), input.slots);

  const guestId = crypto.randomUUID();
  await runBatch(db, [
    db.insert(schema.guest).values({
      id: guestId,
      name: input.name,
      comment: input.comment?.trim() || null,
      browserId,
      projectId,
    }),
    ...insertMany(db, schema.slot, slotRows(input, projectId, guestId)),
  ]);

  return findGuest(db, browserId, projectId);
}

export async function updateMyAvailability(db: Db, browserId: string, projectId: string, input: SubmissionInput) {
  const existingGuest = await findGuest(db, browserId, projectId);

  if (!existingGuest) {
    throw new ServiceError("submission_not_found", "既存の日程が見つかりません。");
  }

  validateSlots(await findProjectForSlots(db, projectId), input.slots);

  // Prisma 版では Slot の削除と回答の更新が別のクエリだった。batch で 1 つのトランザクションにまとめる
  await runBatch(db, [
    db.delete(schema.slot).where(eq(schema.slot.guestId, existingGuest.id)),
    ...insertMany(db, schema.slot, slotRows(input, projectId, existingGuest.id)),
    db
      .update(schema.guest)
      .set({ name: input.name, comment: input.comment?.trim() || null })
      .where(eq(schema.guest.id, existingGuest.id)),
  ]);

  return findGuest(db, browserId, projectId);
}
