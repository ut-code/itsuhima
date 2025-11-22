import { zValidator } from "@hono/zod-validator";
import dotenv from "dotenv";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import { prisma } from "../main.js";

dotenv.config();

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

type AppVariables = {
  browserId: string;
};

const router = new Hono<{ Variables: AppVariables }>()
  // プロジェクト作成
  .post("/", zValidator("json", projectReqSchema), async (c) => {
    const browserId = c.get("browserId");
    try {
      const data = c.req.valid("json");

      const event = await prisma.project.create({
        data: {
          id: nanoid(),
          name: data.name,
          description: data.description.trim() || null,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          allowedRanges: {
            create: data.allowedRanges.map((range) => ({
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
            create: data.participationOptions.map((opt) => ({
              id: opt.id,
              label: opt.label,
              color: opt.color,
            })),
          },
        },
        include: { hosts: true, participationOptions: true },
      });

      return c.json({ id: event.id, name: event.name }, 201);
    } catch (_err) {
      return c.json({ message: "イベント作成時にエラーが発生しました" }, 500);
    }
  })

  // 自分が関連するプロジェクト取得
  .get("/mine", async (c) => {
    const browserId = c.get("browserId");

    try {
      const involvedProjects = await prisma.project.findMany({
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
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          endDate: true,
          hosts: {
            select: {
              browserId: true,
            },
          },
        },
      });

      return c.json(
        involvedProjects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          startDate: p.startDate,
          endDate: p.endDate,
          isHost: p.hosts.some((host) => host.browserId === browserId),
        })),
        200,
      );
    } catch (error) {
      console.error(error);
      return c.json({ message: "エラーが発生しました。" }, 500);
    }
  })

  // プロジェクト取得
  .get("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const browserId = c.get("browserId");

    try {
      const { projectId } = c.req.valid("param");
      const projectRow = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          allowedRanges: true,
          participationOptions: true,
          guests: {
            include: {
              slots: true, // slots 全部欲しいなら select より include
            },
          },
          hosts: true, // 全部欲しいなら select 省略
        },
      });

      if (!projectRow) {
        return c.json({ message: "イベントが見つかりません。" }, 404);
      }

      const data = {
        ...projectRow,
        description: projectRow.description ?? "",
        hosts: projectRow.hosts.map((h) => {
          const { browserId: _, ...rest } = h;
          return rest;
        }),
        guests: projectRow.guests.map((g) => {
          const { browserId: _, ...rest } = g;
          return rest;
        }),
        isHost: projectRow.hosts.some((h) => h.browserId === browserId),
        meAsGuest: projectRow.guests.find((g) => g.browserId === browserId) ?? null,
      };
      return c.json(data, 200);
    } catch (error) {
      console.error("イベント取得エラー:", error);
      return c.json({ message: "イベント取得中にエラーが発生しました。" }, 500);
    }
  })

  // プロジェクト編集
  .put("/:projectId", zValidator("param", projectIdParamsSchema), zValidator("json", editReqSchema), async (c) => {
    const browserId = c.get("browserId");
    try {
      const { projectId } = c.req.valid("param");
      const data = c.req.valid("json");

      // ホスト認証とゲスト存在確認を一括取得
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

      // ホストが存在しなければ403
      if (!host) {
        return c.json({ message: "アクセス権限がありません。" }, 403);
      }

      // 参加形態の更新
      if (data.participationOptions) {
        // 最低1つの参加形態が必要
        if (data.participationOptions.length === 0) {
          return c.json({ message: "参加形態は最低1つ必要です。" }, 400);
        }

        // 削除対象の参加形態に Slot が紐づいているかチェック
        const existingOptions = await prisma.participationOption.findMany({
          where: { projectId },
          include: { slots: { select: { id: true } } },
        });

        const newOptionIds = data.participationOptions.map((o) => o.id);
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
          ...data.participationOptions.map((opt) =>
            prisma.participationOption.upsert({
              where: { id: opt.id },
              update: { label: opt.label, color: opt.color },
              create: { id: opt.id, label: opt.label, color: opt.color, projectId },
            }),
          ),
        ]);
      }

      // 更新処理
      const updatedEvent = await prisma.project.update({
        where: { id: projectId },
        data: existingGuest
          ? {
              name: data.name,
              description: data.description?.trim() || null,
            } // ゲストがいれば名前と説明だけ
          : {
              name: data.name,
              description: data.description?.trim() || null,
              startDate: data.startDate ? new Date(data.startDate) : undefined,
              endDate: data.endDate ? new Date(data.endDate) : undefined,
              allowedRanges: {
                deleteMany: {}, // 既存削除
                create: data.allowedRanges?.map((r) => ({
                  startTime: new Date(r.startTime),
                  endTime: new Date(r.endTime),
                })),
              },
            },
        include: { allowedRanges: true, participationOptions: true },
      });

      return c.json({ event: updatedEvent }, 200);
    } catch (error) {
      console.error("イベント更新エラー:", error);
      return c.json({ message: "イベント更新中にエラーが発生しました。" }, 500);
    }
  })

  // プロジェクト削除
  .delete("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const browserId = c.get("browserId");
    try {
      const { projectId } = c.req.valid("param");
      // Host 認証
      const host = await prisma.host.findFirst({
        where: { projectId, browserId },
      });

      if (!host) {
        return c.json({ message: "削除権限がありません。" }, 403);
      }
      // 関連データを削除（Cascade を使っていない場合）
      await prisma.project.delete({
        where: { id: projectId },
      });
      return c.json({ message: "イベントを削除しました。" }, 200);
    } catch (error) {
      console.error("イベント削除エラー:", error);
      return c.json({ message: "イベント削除中にエラーが発生しました。" }, 500);
    }
  })

  // 日程の提出。
  .post(
    "/:projectId/submissions",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const browserId = c.get("browserId");

      const existingGuest = await prisma.guest.findFirst({
        where: { projectId, browserId },
      });
      if (existingGuest) {
        return c.json({ message: "すでに登録済みです" }, 403);
      }

      const { name, slots } = c.req.valid("json");

      try {
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
        return c.json("日時が登録されました！", 201);
      } catch (error) {
        console.error("登録エラー:", error);
        return c.json({ message: "サーバーエラーが発生しました" }, 500);
      }
    },
  )

  // 日程の更新。
  .put(
    "/:projectId/submissions/mine",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const browserId = c.get("browserId");

      const { name, slots } = c.req.valid("json");

      try {
        const existingGuest = await prisma.guest.findFirst({
          where: { projectId, browserId },
          include: { slots: true },
        });

        if (!existingGuest) {
          return c.json({ message: "ゲスト情報が見つかりません。" }, 404);
        }
        const slotData = slots?.map((slot) => ({
          from: slot.start,
          to: slot.end,
          projectId,
          participationOptionId: slot.participationOptionId,
        }));

        await prisma.slot.deleteMany({ where: { guestId: existingGuest.id } });

        // ゲスト情報更新
        const guest = await prisma.guest.update({
          where: { id: existingGuest.id },
          data: {
            slots: { create: slotData },
            name,
          },
          include: { slots: true },
        });

        return c.json({ message: "ゲスト情報が更新されました！", guest }, 200);
      } catch (error) {
        console.error("処理中のエラー:", error);
        return c.json({ message: "サーバーエラーが発生しました" }, 500);
      }
    },
  );

export default router;
