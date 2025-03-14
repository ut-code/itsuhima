import { Router, Request, Response } from "express";
import {
  EventSchema,
  GuestSchema,
  idSchema,
  SlotSchema,
} from "../../../common/schema";
import { z } from "zod";
import { prisma } from "../main";

const router = Router();
type Slot = z.infer<typeof SlotSchema>;

//イベント作成。Hostのみ。Host作成
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsedData = EventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        name: parsedData.name,
        startDate: parsedData.startDate,
        endDate: parsedData.endDate,
        range: {
          create: parsedData.range,
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
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
    });

    res.status(201).json(event.id);
  } catch (err) {
    console.error("エラー:", err);
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "バリデーションエラー", errors: err.errors });
    }
    res.status(500).json({ message: "イベント作成時にエラーが発生しました" });
  }
});
// イベント情報の取得 Guestのみ
router.get("/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const id = idSchema.parse(eventId);
  const browserId = req.cookies?.browserId || null;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        range: true,
        guests: {
          include: {
            slots: true, // slots 全部欲しいなら select より include
          },
        },
        hosts: true, // 全部欲しいなら select 省略
      },
    });

    // イベントが存在しない場合
    if (!event) {
      return res
        .status(404)
        .json({ message: "指定されたイベントが見つかりません。" });
    }

    // クッキーのブラウザIDと一致するゲスト・ホストを絞り込む
    const guest = event.guests.find((g) => g.browserId === browserId) || null;
    const host = event.hosts.find((h) => h.browserId === browserId) || null;

    // browserIdを外した guest と host を整形
    const filteredGuest = guest
      ? {
          id: guest.id,
          name: guest.name,
          eventId: guest.eventId,
          slots: guest.slots,
        }
      : null;

    const filteredHost = host
      ? {
          id: host.id,
          eventId: host.eventId,
        }
      : null;

    // 成功レスポンス
    res.status(200).json({ event, guest: filteredGuest, host: filteredHost });
  } catch (error) {
    console.error("イベント取得エラー:", error);
    res.status(500).json({ message: "イベント取得中にエラーが発生しました。" });
  }
});

//イベント編集 Hostのみ すでにguestがいたら時間登録はできない
router.put("/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const id = idSchema.parse(eventId);
  const browserId = req.cookies?.browserId;

  try {
    const { name, startDate, endDate, range } = EventSchema.parse(req.body);

    // ホスト認証とゲスト存在確認を一括取得
    const [host, existingGuest] = await Promise.all([
      prisma.host.findFirst({
        where: {
          browserId,
          eventId: id, // eventIdの統一
        },
      }),
      prisma.guest.findFirst({
        where: { eventId: id },
      }),
    ]);

    // ホストが存在しなければ403
    if (!host) {
      return res
        .status(403)
        .json({ message: "認証エラー: アクセス権限がありません。" });
    }

    // 更新処理
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: existingGuest
        ? { name } // ゲストがいれば名前だけ
        : {
            name,
            startDate,
            endDate,
            range: {
              deleteMany: {}, // 既存削除
              create: range.map((r) => ({
                startTime: r.startTime,
                endTime: r.endTime,
              })),
            },
          },
      include: { range: true },
    });

    res.status(200).json({ event: updatedEvent });
  } catch (error) {
    console.error("イベント更新エラー:", error);
    res.status(500).json({ message: "イベント更新中にエラーが発生しました。" });
  }
});

//日程提出。Guestのみ。Guest作成
router.post("/:eventId/submit", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const browserId = req.cookies?.browserId;

  const parsed = GuestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("バリデーションエラー:", parsed.error);
    return res.status(400).json({
      message: "送信データの形式が不正です",
      errors: parsed.error.errors,
    });
  }

  const { name, slots } = parsed.data;

  try {
    const guest = await prisma.guest.create({
      data: {
        name,
        browserId,
        event: { connect: { id: eventId } },
        slots: {
          create: slots.map((slot: Slot) => ({
            start: slot.start,
            end: slot.end,
            eventId,
          })),
        },
      },
      include: { slots: true },
    });

    res.cookie("browserId", guest.browserId, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
    });

    console.log("登録されたデータ:", guest);
    return res.status(201).json("日時が登録されました！");
  } catch (error) {
    console.error("登録エラー:", error);
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

//日程編集。Guestのみ
router.put("/:eventId/submit", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const browserId = req.cookies?.browserId;

  const parsed = GuestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("バリデーションエラー:", parsed.error);
    return res.status(400).json({
      message: "送信データの形式が不正です",
      errors: parsed.error.errors,
    });
  }

  const { name, slots } = parsed.data;

  try {
    const existingGuest = await prisma.guest.findFirst({
      where: { eventId, browserId },
      include: { slots: true },
    });

    const slotData = slots.map((slot: Slot) => ({
      start: slot.start,
      end: slot.end,
      eventId,
    }));

    let guest;

    if (existingGuest) {
      console.log("既存ゲストを更新します。");

      await prisma.slot.deleteMany({ where: { guestId: existingGuest.id } });

      // ゲスト情報更新
      guest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          name,
          slots: { create: slotData },
        },
        include: { slots: true },
      });
    } else {
      console.log("新規ゲストを作成します。");

      // ゲスト新規作成
      guest = await prisma.guest.create({
        data: {
          name,
          browserId,
          event: { connect: { id: eventId } },
          slots: { create: slotData },
        },
        include: { slots: true },
      });

      res.cookie("browserId", guest.browserId, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
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
});

export default router;
