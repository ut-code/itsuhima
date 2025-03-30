import { Router, Request, Response } from "express";
import {
  editReqSchema,
  ProjectRes,
  projectReqSchema,
  submitReqSchema,
} from "../../../common/schema.js";
import { z } from "zod";
import { prisma } from "../main.js";
import { validateRequest } from "../middleware.js";

const isProduction = process.env.NODE_ENV === "prod";

const router = Router();

const projectIdParamsSchema = z.object({ projectId: z.string().uuid() });

// TODO: res の型。エラー時も考慮しないといけない

// プロジェクト作成
router.post("/", validateRequest({ body: projectReqSchema }), async (req, res) => {
  try {
    const data = req.body;
    const event = await prisma.project.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        allowedRanges: {
          create: data.allowedRanges,
        },
        hosts: {
          create: {
            browserId: req.cookies?.browserId || undefined,
          },
        },
      },
      include: { hosts: true },
    });
    const host = event.hosts[0];

    res.cookie("browserId", host.browserId, {
      domain: process.env.DOMAIN,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
    });

    res.status(201).json({ id: event.id, name: event.name });
  } catch (err) {
    res.status(500).json({ message: "イベント作成時にエラーが発生しました" });
  }
});

// プロジェクト取得
router.get(
  "/:projectId",
  validateRequest({ params: projectIdParamsSchema }),
  async (req, res: Response<ProjectRes>) => {
    try {
      const { projectId } = req.params;
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
        // TODO:
        return res.status(404).json();
      }

      // // クッキーのブラウザIDと一致するゲスト・ホストを絞り込む TODO: SQL で
      // const guest = project.guests.find((g) => g.browserId === browserId) || null;
      // const host = project.hosts.find((h) => h.browserId === browserId) || null;

      // // browserIdを外した guest と host を整形
      // const filteredGuest = guest
      //   ? {
      //       id: guest.id,
      //       name: guest.name,
      //       eventId: guest.eventId,
      //       slots: guest.slots,
      //     }
      //   : null;

      // const filteredHost = host
      //   ? {
      //       id: host.id,
      //       eventId: host.eventId,
      //     }
      //   : null;

      res.status(200).json({
        ...project,
      });
    } catch (error) {
      console.error("イベント取得エラー:", error);
      // TODO:
      res.status(500).json();
    }
  }
);

// プロジェクト編集
router.put(
  "/:projectId",
  validateRequest({
    params: projectIdParamsSchema,
    body: editReqSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.cookies?.browserId;
    try {
      const { name, startDate, endDate, allowedRanges } = req.body;

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
        return res.status(403).json({ message: "認証エラー: アクセス権限がありません。" });
      }

      // 更新処理
      console.log(projectId);
      const updatedEvent = await prisma.project.update({
        where: { id: projectId },
        data: existingGuest
          ? { name } // ゲストがいれば名前だけ
          : {
              name,
              startDate,
              endDate,
              allowedRanges: {
                deleteMany: {}, // 既存削除
                create: allowedRanges?.map((r) => ({
                  startTime: r.startTime,
                  endTime: r.endTime,
                })),
              },
            },
        include: { allowedRanges: true },
      });

      res.status(200).json({ event: updatedEvent });
    } catch (error) {
      console.error("イベント更新エラー:", error);
      res.status(500).json({ message: "イベント更新中にエラーが発生しました。" });
    }
  }
);

// 日程の提出。
router.post(
  "/:projectId/availabilities",
  validateRequest({
    params: projectIdParamsSchema,
    body: submitReqSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.cookies?.browserId;

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

      res.cookie("browserId", guest.browserId, {
        domain: process.env.DOMAIN,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
      });

      console.log("登録されたデータ:", guest);
      return res.status(201).json("日時が登録されました！");
    } catch (error) {
      console.error("登録エラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  }
);

// 日程の編集。
router.put(
  "/:projectId/availabilities",
  validateRequest({
    params: projectIdParamsSchema,
    body: submitReqSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.cookies?.browserId;

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

      let guest;

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
        message: existingGuest
          ? "ゲスト情報が更新されました！"
          : "ゲスト情報が新規作成されました！",
        guest,
      });
    } catch (error) {
      console.error("処理中のエラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  }
);
// イベント削除（Hostのみ）
router.delete(
  "/:projectId",
  validateRequest({
    params: projectIdParamsSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.cookies?.browserId;

    try {
      // Host 認証
      const host = await prisma.host.findFirst({
        where: { projectId, browserId },
      });

      if (!host) {
        return res.status(403).json({ message: "認証エラー: 削除権限がありません。" });
      }

      // 関連データを削除（Cascade を使っていない場合）
      await prisma.project.delete({
        where: { id: projectId },
      });

      return res.status(200).json({ message: "イベントを削除しました。" });
    } catch (error) {
      console.error("イベント削除エラー:", error);
      return res.status(500).json({ message: "イベント削除中にエラーが発生しました。" });
    }
  }
);

export default router;
