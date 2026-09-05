import { DEFAULT_PARTICIPATION_OPTION } from "../../../common/colors.js";
import { prisma } from "../db.js";
import dayjs, { APP_TIMEZONE } from "../lib/dayjs.js";
import { nanoid } from "../lib/id.js";
import { type Actor, assertScope, UseCaseError } from "./types.js";

/** 1 回の提出で登録できる Slot 数の上限。LLM の暴走で DB を膨らませないための保険。 */
const MAX_SLOTS_PER_SUBMISSION = 1000;

export type SlotInput = {
  start: Date;
  end: Date;
  participationOptionId: string;
};

export type SubmissionInput = {
  name: string;
  comment?: string | null;
  slots: SlotInput[];
};

export type ParticipationOptionInput = {
  id: string;
  label: string;
  color: string;
};

export type CreateProjectInput = {
  name: string;
  description: string;
  startDate: string | Date;
  endDate: string | Date;
  allowedRanges: { startTime: string | Date; endTime: string | Date }[];
  participationOptions: ParticipationOptionInput[];
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

// ---------------------------------------------------------------------------
// 日時ユーティリティ（AllowedRange は UTC 保存だが意味は JST の壁時計時刻）
// ---------------------------------------------------------------------------

/** JST の暦日（YYYY-MM-DD） */
function jstDate(value: Date): string {
  return dayjs(value).tz(APP_TIMEZONE).format("YYYY-MM-DD");
}

/** JST における 0 時からの経過分 */
function jstMinutesOfDay(value: Date): number {
  const d = dayjs(value).tz(APP_TIMEZONE);
  return d.hour() * 60 + d.minute();
}

/** JST の "HH:mm" 表記 */
export function jstTimeOfDay(value: Date): string {
  return dayjs(value).tz(APP_TIMEZONE).format("HH:mm");
}

function isQuarterHour(value: Date): boolean {
  const d = dayjs(value).tz(APP_TIMEZONE);
  return d.second() === 0 && d.millisecond() === 0 && [0, 15, 30, 45].includes(d.minute());
}

type ValidationTarget = {
  startDate: Date;
  endDate: Date;
  allowedRanges: { startTime: Date; endTime: Date }[];
  participationOptions: { id: string; label: string }[];
};

/**
 * 提出された Slot がイベントの日程範囲・時間帯・15分グリッドに収まっているか検証する。
 *
 * Web UI ではカレンダーの構造上ここを踏むことはないが、MCP 経由では UI を通らないため
 * 不正な Slot を作り放題になる。範囲外 Slot は描画クラッシュの原因になった実績があるので
 * (#91)、ユースケース層で必ず弾く。
 */
function validateSlots(project: ValidationTarget, slots: SlotInput[]): void {
  if (slots.length > MAX_SLOTS_PER_SUBMISSION) {
    throw new UseCaseError(
      400,
      `一度に登録できる時間帯は ${MAX_SLOTS_PER_SUBMISSION} 件までです（${slots.length} 件が指定されました）。連続する時間帯はひとつにまとめてください。`,
    );
  }

  const minDate = jstDate(project.startDate);
  const maxDate = jstDate(project.endDate);
  const optionIds = new Set(project.participationOptions.map((o) => o.id));
  // AllowedRange は現在 1 つのみ。未設定なら終日許可とみなす。
  const range = project.allowedRanges[0];
  const rangeStart = range ? jstMinutesOfDay(range.startTime) : 0;
  const rangeEnd = range ? jstMinutesOfDay(range.endTime) : 24 * 60;

  slots.forEach((slot, i) => {
    const label = `${i + 1} 件目の時間帯 (${dayjs(slot.start).tz(APP_TIMEZONE).format("YYYY-MM-DD HH:mm")} 〜 ${dayjs(
      slot.end,
    )
      .tz(APP_TIMEZONE)
      .format("HH:mm")})`;

    if (!(slot.start.getTime() < slot.end.getTime())) {
      throw new UseCaseError(400, `${label}: 開始時刻は終了時刻より前でなければなりません。`);
    }
    if (!isQuarterHour(slot.start) || !isQuarterHour(slot.end)) {
      throw new UseCaseError(
        400,
        `${label}: 時刻は 15 分単位（:00 / :15 / :30 / :45）で指定してください。近い 15 分の境界に丸めて指定し直してください。`,
      );
    }

    const day = jstDate(slot.start);
    if (day !== jstDate(slot.end)) {
      throw new UseCaseError(
        400,
        `${label}: ひとつの時間帯が日をまたいでいます。日付ごとに分割して指定してください（タイムゾーンは ${APP_TIMEZONE}）。`,
      );
    }
    if (day < minDate || day > maxDate) {
      throw new UseCaseError(
        400,
        `${label}: このイベントの日程範囲（${minDate} 〜 ${maxDate}）の外です。範囲内の日付を指定してください。`,
      );
    }

    const startMinutes = jstMinutesOfDay(slot.start);
    const endMinutes = jstMinutesOfDay(slot.end);
    if (startMinutes < rangeStart || endMinutes > rangeEnd) {
      const rangeLabel = range ? `${jstTimeOfDay(range.startTime)} 〜 ${jstTimeOfDay(range.endTime)}` : "終日";
      throw new UseCaseError(
        400,
        `${label}: このイベントで入力できる時間帯（${rangeLabel}）の外です。時間帯内に収めて指定し直してください。`,
      );
    }

    if (!optionIds.has(slot.participationOptionId)) {
      const available = project.participationOptions.map((o) => `${o.label}=${o.id}`).join(", ");
      throw new UseCaseError(
        400,
        `${label}: 参加形態 ID "${slot.participationOptionId}" はこのイベントに存在しません。利用可能な参加形態: ${available}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// ユースケース
// ---------------------------------------------------------------------------

export async function createProject(actor: Actor, input: CreateProjectInput) {
  assertScope(actor, "create");

  const participationOptions =
    input.participationOptions.length > 0
      ? input.participationOptions
      : [{ id: crypto.randomUUID(), ...DEFAULT_PARTICIPATION_OPTION }];

  const project = await prisma.project.create({
    data: {
      id: nanoid(),
      name: input.name,
      description: input.description.trim() || null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      allowedRanges: {
        create: input.allowedRanges.map((range) => ({
          startTime: new Date(range.startTime),
          endTime: new Date(range.endTime),
        })),
      },
      hosts: {
        create: { browserId: actor.browserId },
      },
      participationOptions: {
        create: participationOptions.map((opt) => ({
          id: opt.id,
          label: opt.label,
          color: opt.color,
        })),
      },
    },
    select: { id: true, name: true },
  });

  return project;
}

export async function listMyProjects(actor: Actor) {
  assertScope(actor, "read");
  const { browserId } = actor;

  const projects = await prisma.project.findMany({
    where: {
      OR: [{ hosts: { some: { browserId } } }, { guests: { some: { browserId } } }],
    },
    include: {
      hosts: { select: { browserId: true } },
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

/** 権限判定に必要な関連まで含めた Project を取得する。存在しなければ 404。 */
export async function findProjectOrThrow(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      allowedRanges: true,
      participationOptions: true,
      guests: { include: { slots: true } },
      hosts: true,
    },
  });

  if (!project) {
    throw new UseCaseError(404, "イベントが見つかりません。イベント ID を確認してください。");
  }
  return project;
}

export type ProjectWithRelations = Awaited<ReturnType<typeof findProjectOrThrow>>;

/**
 * イベント詳細。
 *
 * 注: Web では「URL（イベント ID）を知っていること」自体が閲覧権限なので、
 * メンバーシップは要求しない。MCP から呼ぶ場合は事前に assertMembership すること。
 */
export async function getProjectDetail(actor: Actor, projectId: string) {
  assertScope(actor, "read");
  const project = await findProjectOrThrow(projectId);
  const { browserId } = actor;

  const guest = project.guests.find((g) => g.browserId === browserId);
  const meAsGuest = guest ? stripBrowserId(guest) : null;

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: project.startDate,
    endDate: project.endDate,
    allowedRanges: project.allowedRanges,
    participationOptions: project.participationOptions,
    hosts: project.hosts.map(stripBrowserId),
    guests: project.guests.map(stripBrowserId),
    isHost: project.hosts.some((h) => h.browserId === browserId),
    meAsGuest,
  };
}

function stripBrowserId<T extends { browserId: string }>(entity: T): Omit<T, "browserId"> {
  const { browserId: _browserId, ...rest } = entity;
  return rest;
}

/** host または guest として関わっているイベントか。MCP の閲覧系はこれを必須にする。 */
export function assertMembership(actor: Actor, project: ProjectWithRelations): void {
  const isMember =
    project.hosts.some((h) => h.browserId === actor.browserId) ||
    project.guests.some((g) => g.browserId === actor.browserId);
  if (!isMember) {
    throw new UseCaseError(
      403,
      "このイベントにアクセスする権限がありません。主催者または参加者として関わっているイベントのみ操作できます。",
    );
  }
}

export async function updateProject(actor: Actor, projectId: string, input: UpdateProjectInput) {
  assertScope(actor, "create");

  const [host, existingGuest] = await Promise.all([
    prisma.host.findFirst({ where: { browserId: actor.browserId, projectId } }),
    prisma.guest.findFirst({ where: { projectId } }),
  ]);

  if (!host) {
    throw new UseCaseError(403, "アクセス権限がありません。");
  }

  if (input.participationOptions) {
    if (input.participationOptions.length === 0) {
      throw new UseCaseError(400, "参加形態は最低1つ必要です。");
    }

    // 削除対象の参加形態に Slot が紐づいているかチェック
    const existingOptions = await prisma.participationOption.findMany({
      where: { projectId },
      include: { slots: { select: { id: true } } },
    });
    const newOptionIds = input.participationOptions.map((o) => o.id);
    const optionsToDelete = existingOptions.filter((o) => !newOptionIds.includes(o.id));
    const undeletableOptions = optionsToDelete.filter((o) => o.slots.length > 0);
    if (undeletableOptions.length > 0) {
      const labels = undeletableOptions.map((o) => o.label).join(", ");
      throw new UseCaseError(400, `以下の参加形態は日程が登録されているため削除できません: ${labels}`);
    }

    await prisma.$transaction([
      prisma.participationOption.deleteMany({
        where: { projectId, id: { notIn: newOptionIds } },
      }),
      ...input.participationOptions.map((opt) =>
        prisma.participationOption.upsert({
          where: { id: opt.id },
          update: { label: opt.label, color: opt.color },
          create: { id: opt.id, label: opt.label, color: opt.color, projectId },
        }),
      ),
    ]);
  }

  // 既にゲストの回答がある場合、日程範囲と時間帯は変更させない
  return prisma.project.update({
    where: { id: projectId },
    data: existingGuest
      ? {
          name: input.name,
          description: input.description?.trim() || null,
        }
      : {
          name: input.name,
          description: input.description?.trim() || null,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          allowedRanges: {
            deleteMany: {},
            create: input.allowedRanges?.map((r) => ({
              startTime: new Date(r.startTime),
              endTime: new Date(r.endTime),
            })),
          },
        },
    include: { allowedRanges: true, participationOptions: true },
  });
}

export async function deleteProject(actor: Actor, projectId: string) {
  assertScope(actor, "create");

  const host = await prisma.host.findUnique({
    where: { browserId_projectId: { browserId: actor.browserId, projectId } },
  });
  if (!host) {
    throw new UseCaseError(403, "削除権限がありません。");
  }

  await prisma.project.delete({ where: { id: projectId } });
}

export async function submitAvailability(actor: Actor, projectId: string, input: SubmissionInput) {
  assertScope(actor, "submit");

  const project = await findProjectOrThrow(projectId);
  const existingGuest = project.guests.find((g) => g.browserId === actor.browserId);
  if (existingGuest) {
    throw new UseCaseError(
      409,
      "このイベントには既に日程を提出済みです。内容を変更する場合は update_availability（日程の更新）を使ってください。",
    );
  }

  validateSlots(project, input.slots);

  return prisma.guest.create({
    data: {
      name: input.name,
      comment: input.comment?.trim() || null,
      browserId: actor.browserId,
      project: { connect: { id: projectId } },
      slots: {
        create: input.slots.map((slot) => ({
          from: slot.start,
          to: slot.end,
          projectId,
          participationOptionId: slot.participationOptionId,
        })),
      },
    },
    include: { slots: true },
  });
}

export async function updateMyAvailability(
  actor: Actor,
  projectId: string,
  input: SubmissionInput,
  /** 楽観ロック用。Guest.updatedAt の ISO 文字列。未指定ならチェックしない（Web UI 用）。 */
  basedOnVersion?: string,
) {
  assertScope(actor, "submit");

  const project = await findProjectOrThrow(projectId);
  const existingGuest = project.guests.find((g) => g.browserId === actor.browserId);
  if (!existingGuest) {
    throw new UseCaseError(
      404,
      "このイベントにはまだ日程を提出していません。先に submit_availability（日程の提出）を使ってください。",
    );
  }

  if (basedOnVersion !== undefined && basedOnVersion !== existingGuest.updatedAt.toISOString()) {
    throw new UseCaseError(
      409,
      "別の端末から日程が更新されています。get_event で最新の内容と version を取得し直してから、もう一度更新してください。",
    );
  }

  validateSlots(project, input.slots);

  const slotData = input.slots.map((slot) => ({
    from: slot.start,
    to: slot.end,
    projectId,
    participationOptionId: slot.participationOptionId,
  }));

  // 全置換。既存 Slot を消してから作り直す。
  await prisma.slot.deleteMany({ where: { guestId: existingGuest.id } });

  return prisma.guest.update({
    where: { id: existingGuest.id },
    data: {
      slots: { create: slotData },
      name: input.name,
      comment: input.comment?.trim() || null,
    },
    include: { slots: true },
  });
}
