import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  type InvolvedProjects,
  // type ProjectRes,
  editReqSchema,
  projectReqSchema,
  submitReqSchema,
} from "../../../common/schema.js";
import { cookieOptions, prisma } from "../main.js";

import dotenv from "dotenv";
dotenv.config();

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

const router = new Hono()
  // プロジェクト作成
  .post("/", zValidator("json", projectReqSchema), async (c) => {
    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) {
      console.error("COOKIE_SECRET is not set");
      return c.json({ message: "サーバー設定エラー" }, 500);
    }
    const browserId = (await getSignedCookie(c, cookieSecret, "browserId")) || undefined;
    try {
      const data = c.req.valid("json");
      const event = await prisma.project.create({
        data: {
          id: nanoid(),
          name: data.name,
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
        },
        include: { hosts: true },
      });
      const host = event.hosts[0];

      await setSignedCookie(c, "browserId", host.browserId, cookieSecret, cookieOptions);
      return c.json({ id: event.id, name: event.name }, 201);
    } catch (err) {
      return c.json({ message: "イベント作成時にエラーが発生しました" }, 500);
    }
  })

  // 自分が関連するプロジェクト取得
  .get("/mine", async (c) => {
    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) {
      console.error("COOKIE_SECRET is not set");
      return c.json({ message: "サーバー側でエラーが発生しています。" }, 500);
    }

    const browserId = await getSignedCookie(c, cookieSecret, "browserId");
    if (!browserId) {
      return c.json({ message: "認証されていません。" }, 401);
    }

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
    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) {
      console.error("COOKIE_SECRET is not set");
      return c.json({ message: "サーバー側でエラーが発生しています。" }, 500);
    }

    const browserId = await getSignedCookie(c, cookieSecret, "browserId");

    try {
      const { projectId } = c.req.valid("param");
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          allowedRanges: true,
          guests: {
            include: {
              slots: true, // slots 全部欲しいなら select より include
            },
          },
          hosts: true, // 全部欲しいなら select 省略
        },
      });

      if (!project) {
        return c.json({ message: "イベントが見つかりません。" }, 404);
      }

      return c.json(
        {
          ...project,
          hosts: project.hosts.map((h) => {
            const { browserId, ...rest } = h;
            return rest;
          }),
          guests: project.guests.map((g) => {
            const { browserId, ...rest } = g;
            return rest;
          }),
          isHost: browserId ? project.hosts.some((h) => h.browserId === browserId) : false,
          meAsGuest: browserId ? (project.guests.find((g) => g.browserId === browserId) ?? null) : null,
        },
        200,
      );
    } catch (error) {
      console.error("イベント取得エラー:", error);
      return c.json({ message: "イベント取得中にエラーが発生しました。" }, 500);
    }
  })

  // プロジェクト編集
  .put("/:projectId", zValidator("param", projectIdParamsSchema), zValidator("json", editReqSchema), async (c) => {
    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) {
      console.error("COOKIE_SECRET is not set");
      return c.json({ message: "サーバー設定エラー" }, 500);
    }
    const browserId = (await getSignedCookie(c, cookieSecret, "browserId")) || undefined;
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
      // 更新処理
      const updatedEvent = await prisma.project.update({
        where: { id: projectId },
        data: existingGuest
          ? { name: data.name } // ゲストがいれば名前だけ
          : {
              name: data.name,
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
        include: { allowedRanges: true },
      });

      return c.json({ event: updatedEvent }, 200);
    } catch (error) {
      console.error("イベント更新エラー:", error);
      return c.json({ message: "イベント更新中にエラーが発生しました。" }, 500);
    }
  })

  // プロジェクト削除
  .delete("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) {
      console.error("COOKIE_SECRET is not set");
      return c.json({ message: "サーバー設定エラー" }, 500);
    }
    const browserId = await getSignedCookie(c, cookieSecret, "browserId");
    if (!browserId) {
      return c.json({ message: "認証されていません。" }, 401);
    }
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
  });

// 日程の提出。
router.post(
  "/:projectId/submissions",
  validateRequest({
    params: projectIdParamsSchema,
    body: submitReqSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.signedCookies?.browserId;

    if (browserId) {
      const existingGuest = await prisma.guest.findFirst({
        where: { projectId, browserId },
      });
      if (existingGuest) {
        return res.status(403).json({ message: "すでに登録済みです" });
      }
    }

    const { name, slots } = req.body;

    try {
      const guest = await prisma.guest.create({
        data: {
          name,
          browserId,
          project: { connect: { id: projectId } },
          slots: {
            create: slots?.map((slot) => ({
              from: slot.start,
              to: slot.end,
              projectId,
            })),
          },
        },
        include: { slots: true },
      });

      res.cookie("browserId", guest.browserId, cookieOptions);
      return res.status(201).json("日時が登録されました！");
    } catch (error) {
      console.error("登録エラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  },
);

// 日程の更新。
router.put(
  "/:projectId/submissions/mine",
  validateRequest({
    params: projectIdParamsSchema,
    body: submitReqSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.signedCookies?.browserId;

    const { slots, name } = req.body;

    try {
      const existingGuest = await prisma.guest.findFirst({
        where: { projectId, browserId },
        include: { slots: true },
      });

      const slotData = slots?.map((slot) => ({
        from: slot.start,
        to: slot.end,
        projectId,
      }));

      let guest: unknown; // FIXME: apply an actual type

      if (existingGuest) {
        await prisma.slot.deleteMany({ where: { guestId: existingGuest.id } });

        // ゲスト情報更新
        guest = await prisma.guest.update({
          where: { id: existingGuest.id },
          data: {
            slots: { create: slotData },
            name,
          },
          include: { slots: true },
        });
      }

      return res.status(existingGuest ? 200 : 201).json({
        message: existingGuest ? "ゲスト情報が更新されました！" : "ゲスト情報が新規作成されました！",
        guest,
      });
    } catch (error) {
      console.error("処理中のエラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  },
);

export default router;
