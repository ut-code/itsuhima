import { zValidator } from "@hono/zod-validator";
import dotenv from "dotenv";
import { Hono } from "hono";
import { z } from "zod";
import { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import { type AppVariables, nanoid, prisma } from "../main.js";

dotenv.config();

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

const router = new Hono<{ Variables: AppVariables }>()
  // プロジェクト作成
  .post("/", zValidator("json", projectReqSchema), async (c) => {
    const browserId = c.get("browserId");
    const input = c.req.valid("json");

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

    return c.json({ id: project.id, name: project.name }, 201);
  })

  // 自分が関連するプロジェクト取得
  .get("/mine", async (c) => {
    const browserId = c.get("browserId");

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

    return c.json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        startDate: p.startDate,
        endDate: p.endDate,
        isHost: p.hosts.some((host) => host.browserId === browserId),
      })),
      200,
    );
  })

  // プロジェクト取得
  .get("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const browserId = c.get("browserId");
    const { projectId } = c.req.valid("param");

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
      return c.json({ message: "イベントが見つかりません。" }, 404);
    }

    const guest = project.guests.find((g) => g.browserId === browserId);
    const meAsGuest = guest ? (({ browserId, ...rest }) => rest)(guest) : null;

    return c.json(
      {
        id: project.id,
        name: project.name,
        description: project.description ?? "",
        startDate: project.startDate,
        endDate: project.endDate,
        allowedRanges: project.allowedRanges,
        participationOptions: project.participationOptions,
        hosts: project.hosts.map(({ browserId, ...rest }) => rest),
        guests: project.guests.map(({ browserId, ...rest }) => rest),
        isHost: project.hosts.some((h) => h.browserId === browserId),
        meAsGuest,
      },
      200,
    );
  })

  // プロジェクト編集
  .put("/:projectId", zValidator("param", projectIdParamsSchema), zValidator("json", editReqSchema), async (c) => {
    const browserId = c.get("browserId");
    const { projectId } = c.req.valid("param");
    const input = c.req.valid("json");

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
      return c.json({ message: "アクセス権限がありません。" }, 403);
    }

    // 参加形態の更新
    if (input.participationOptions) {
      if (input.participationOptions.length === 0) {
        return c.json({ message: "参加形態は最低1つ必要です。" }, 400);
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
        return c.json(
          {
            message: `以下の参加形態は日程が登録されているため削除できません: ${labels}`,
          },
          400,
        );
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

    const updatedProject = await prisma.project.update({
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

    return c.json({ event: updatedProject }, 200);
  })

  // プロジェクト削除
  .delete("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const browserId = c.get("browserId");
    const { projectId } = c.req.valid("param");

    const host = await prisma.host.findUnique({
      where: {
        browserId_projectId: {
          browserId,
          projectId,
        },
      },
    });

    if (!host) {
      return c.json({ message: "削除権限がありません。" }, 403);
    }

    await prisma.project.delete({
      where: { id: projectId },
    });
    return c.json(204);
  })

  // 日程の提出。
  .post(
    "/:projectId/submissions",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const browserId = c.get("browserId");
      const { projectId } = c.req.valid("param");
      const { name, slots } = c.req.valid("json");

      const existingGuest = await prisma.guest.findUnique({
        where: {
          browserId_projectId: {
            browserId,
            projectId,
          },
        },
      });
      if (existingGuest) {
        return c.json({ message: "提出済みです。" }, 403);
      }

      await prisma.guest.create({
        data: {
          name,
          browserId,
          project: { connect: { id: projectId } },
          slots: {
            create: slots?.map((slot) => ({
              from: slot.start,
              to: slot.end,
              projectId,
              participationOptionId: slot.participationOptionId,
            })),
          },
        },
        include: { slots: true },
      });
      return c.json("日程が提出されました。", 201);
    },
  )

  // 日程の更新。
  .put(
    "/:projectId/submissions/mine",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const browserId = c.get("browserId");
      const { projectId } = c.req.valid("param");
      const { name, slots } = c.req.valid("json");

      const existingGuest = await prisma.guest.findUnique({
        where: { browserId_projectId: { browserId, projectId } },
        include: { slots: true },
      });

      if (!existingGuest) {
        return c.json({ message: "既存の日程が見つかりません。" }, 404);
      }
      const slotData = slots?.map((slot) => ({
        from: slot.start,
        to: slot.end,
        projectId,
        participationOptionId: slot.participationOptionId,
      }));

      await prisma.slot.deleteMany({ where: { guestId: existingGuest.id } });

      const guest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          slots: { create: slotData },
          name,
        },
        include: { slots: true },
      });

      return c.json({ message: "日程が更新されました。", guest }, 200);
    },
  );

export default router;
