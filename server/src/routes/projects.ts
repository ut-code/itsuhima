// @ts-nocheck FIXME: 駄目すぎる
import { type Response, Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  type InvolvedProjects,
  type ProjectRes,
  editReqSchema,
  projectReqSchema,
  submitReqSchema,
} from "../../../common/schema.js";
import { cookieOptions, prisma } from "../main.js";
import { validateRequest } from "../middleware.js";

const router = Router();

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

// TODO: res の型。エラー時も考慮しないといけない

// プロジェクト作成
router.post("/", validateRequest({ body: projectReqSchema }), async (req, res) => {
  const browserId = req.signedCookies.browserId;
  try {
    const data = req.body;
    const event = await prisma.project.create({
      data: {
        id: nanoid(),
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        allowedRanges: {
          create: data.allowedRanges.map(range => ({
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

    res.cookie("browserId", host.browserId, cookieOptions);

    res.status(201).json({ id: event.id, name: event.name });
  } catch (err) {
    res.status(500).json({ message: "イベント作成時にエラーが発生しました" });
  }
});

// 自分が関連するプロジェクト取得
router.get("/mine", async (req, res: Response<InvolvedProjects>) => {
  const browserId = req.signedCookies?.browserId;

  if (!browserId) {
    // return res.status(401).json({ message: "認証情報がありません。" }); TODO: a
    return res.status(401).json([]);
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

    return res.status(200).json(
      involvedProjects.map((p) => ({
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        isHost: p.hosts.some((host) => host.browserId === browserId),
      })),
    );
  } catch (error) {
    console.error("ユーザー検索エラー:", error);
    return res.status(500).json(); // TODO:
    // .json({ message: "ユーザー検索中にエラーが発生しました。" });
  }
});

// プロジェクト取得
router.get(
  "/:projectId",
  validateRequest({ params: projectIdParamsSchema }),
  async (req, res: Response<ProjectRes>) => {
    const browserId = req.signedCookies?.browserId;
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
        hosts: project.hosts.map((h) => {
          const { browserId, ...rest } = h;
          return rest;
        }),
        guests: project.guests.map((g) => {
          const { browserId, ...rest } = g;
          return rest;
        }),
        isHost: project.hosts.some((h) => h.browserId === browserId),
        meAsGuest: project.guests.find((g) => g.browserId === browserId) ?? null,
      });
    } catch (error) {
      console.error("イベント取得エラー:", error);
      // TODO:
      res.status(500).json();
    }
  },
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
    const browserId = req.signedCookies?.browserId;
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
      const updatedEvent = await prisma.project.update({
        where: { id: projectId },
        data: existingGuest
          ? { name } // ゲストがいれば名前だけ
          : {
              name,
              startDate: startDate ? new Date(startDate) : undefined,
              endDate: endDate ? new Date(endDate) : undefined,
              allowedRanges: {
                deleteMany: {}, // 既存削除
                create: allowedRanges?.map((r) => ({
                  startTime: new Date(r.startTime),
                  endTime: new Date(r.endTime),
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
  },
);

// プロジェクト削除
router.delete(
  "/:projectId",
  validateRequest({
    params: projectIdParamsSchema,
  }),
  async (req, res: Response) => {
    const { projectId } = req.params;
    const browserId = req.signedCookies?.browserId;

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
  },
);

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
