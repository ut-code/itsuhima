import type { z } from "zod";
import type { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import { prisma } from "../db.js";
import { nanoid } from "../lib/id.js";
import { ServiceError } from "./errors.js";
import { validateSlots } from "./slots.js";

export type CreateProjectInput = z.infer<typeof projectReqSchema>;
export type UpdateProjectInput = z.infer<typeof editReqSchema>;
export type SubmissionInput = Omit<z.infer<typeof submitReqSchema>, "projectId">;

export async function createProject(browserId: string, input: CreateProjectInput) {
  return prisma.project.create({
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
        create: {
          browserId,
        },
      },
      participationOptions: {
        create: input.participationOptions.map((opt) => ({
          id: opt.id,
          label: opt.label,
          color: opt.color,
        })),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
}

/** ホストまたはゲストとして関わるプロジェクト */
export async function listMyProjects(browserId: string) {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { hosts: { some: { browserId } } },
        {
          guests: {
            some: { browserId },
          },
        },
      ],
    },
    include: {
      hosts: {
        select: { browserId: true },
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
export async function getProject(browserId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      allowedRanges: true,
      participationOptions: true,
      guests: {
        include: {
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
    allowedRanges: project.allowedRanges,
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

export async function updateProject(browserId: string, projectId: string, input: UpdateProjectInput) {
  const [host, existingGuest] = await Promise.all([
    prisma.host.findFirst({
      where: {
        browserId,
        projectId: projectId,
      },
    }),
    prisma.guest.findFirst({
      where: { projectId: projectId },
    }),
  ]);

  if (!host) {
    throw new ServiceError("not_host", "アクセス権限がありません。");
  }

  // 参加形態の更新
  if (input.participationOptions) {
    if (input.participationOptions.length === 0) {
      throw new ServiceError("options_empty", "参加形態は最低1つ必要です。");
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
      throw new ServiceError("option_in_use", `以下の参加形態は日程が登録されているため削除できません: ${labels}`);
    }

    await prisma.$transaction([
      // 既存の参加形態で、新しいリストにないものを削除
      prisma.participationOption.deleteMany({
        where: {
          projectId,
          id: {
            notIn: newOptionIds,
          },
        },
      }),
      // 既存の参加形態を更新または新規作成
      ...input.participationOptions.map((opt) =>
        prisma.participationOption.upsert({
          where: { id: opt.id },
          update: { label: opt.label, color: opt.color },
          create: { id: opt.id, label: opt.label, color: opt.color, projectId },
        }),
      ),
    ]);
  }

  // ゲストの回答があれば、日程と時間帯は変えない
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
            deleteMany: {}, // 既存削除
            create: input.allowedRanges?.map((r) => ({
              startTime: new Date(r.startTime),
              endTime: new Date(r.endTime),
            })),
          },
        },
    include: { allowedRanges: true, participationOptions: true },
  });
}

export async function deleteProject(browserId: string, projectId: string) {
  const host = await prisma.host.findUnique({
    where: {
      browserId_projectId: {
        browserId,
        projectId,
      },
    },
  });

  if (!host) {
    throw new ServiceError("not_host", "削除権限がありません。");
  }

  await prisma.project.delete({
    where: { id: projectId },
  });
}

/** Slot の検証に必要な分だけプロジェクトを読む */
async function findProjectForSlots(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      startDate: true,
      endDate: true,
      allowedRanges: { select: { startTime: true, endTime: true } },
      participationOptions: { select: { id: true } },
    },
  });
  if (!project) {
    throw new ServiceError("project_not_found", "イベントが見つかりません。");
  }
  return project;
}

export async function submitAvailability(browserId: string, projectId: string, input: SubmissionInput) {
  const existingGuest = await prisma.guest.findUnique({
    where: {
      browserId_projectId: {
        browserId,
        projectId,
      },
    },
  });
  if (existingGuest) {
    throw new ServiceError("already_submitted", "提出済みです。");
  }

  validateSlots(await findProjectForSlots(projectId), input.slots);

  return prisma.guest.create({
    data: {
      name: input.name,
      comment: input.comment?.trim() || null,
      browserId,
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

export async function updateMyAvailability(browserId: string, projectId: string, input: SubmissionInput) {
  const existingGuest = await prisma.guest.findUnique({
    where: { browserId_projectId: { browserId, projectId } },
    include: { slots: true },
  });

  if (!existingGuest) {
    throw new ServiceError("submission_not_found", "既存の日程が見つかりません。");
  }

  validateSlots(await findProjectForSlots(projectId), input.slots);

  const slotData = input.slots.map((slot) => ({
    from: slot.start,
    to: slot.end,
    projectId,
    participationOptionId: slot.participationOptionId,
  }));

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
