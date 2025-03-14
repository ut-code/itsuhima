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

router.get("/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const id = idSchema.parse(eventId);
  console.log("Cookieだよ", req.cookies?.browserId);
  const browserId = req.cookies?.browserId || null;

  try {
    // イベント情報の取得（そのまま返す場合）
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        range: true,
        guests: {
          select: {
            id: true,
            name: true,
            eventId: true,
            slots: {
              select: {
                id: true,
                start: true,
                end: true,
              },
            },
          },
        },
        slots: true, // そのまま返す
      },
    });

    // イベントが存在しない場合
    if (!event) {
      return res
        .status(404)
        .json({ message: "指定されたイベントが見つかりません。" });
    }

    let guest = null;
    let host = null;

    // browserId がある場合、該当するゲスト・ホスト情報の取得
    if (browserId) {
      guest = await prisma.guest.findFirst({
        where: {
          eventId: id,
          browserId: browserId,
        },
        select: {
          id: true,
          name: true,
          eventId: true,
          slots: {
            select: {
              id: true,
              start: true,
              end: true,
            },
          },
        },
      });

      host = await prisma.host.findFirst({
        where: {
          browserId: browserId,
          eventId: eventId,
        },
        select: {
          id: true,
          eventId: true,
        },
      });
    }

    // 成功レスポンス
    res.status(200).json({ event, guest, host });
  } catch (error) {
    console.error("イベント取得エラー:", error);
    res.status(500).json({ message: "イベント取得中にエラーが発生しました。" });
  }
});

//Hostのみ すでにguestがいたら時間登録はできない
router.put("/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const id = idSchema.parse(eventId);
  console.log("Cookieだよ", req.cookies?.browserId);

  try {
    // ホスト認証
    const host = await prisma.host.findFirst({
      where: {
        browserId: req.cookies?.browserId,
        eventId: eventId,
      },
    });

    // ホストが存在しなければ403
    if (!host) {
      return res
        .status(403)
        .json({ message: "認証エラー: アクセス権限がありません。" });
    }

    // リクエストボディのバリデーション
    const { name, startDate, endDate, range } = EventSchema.parse(req.body);

    // すでにゲストが存在するか確認
    const existingGuest = await prisma.guest.findFirst({
      where: { eventId: id },
    });

    let updatedEvent;

    if (existingGuest) {
      // ゲストが登録済み → 名前だけ更新
      console.log("ゲストがいるため、イベント名のみ更新します。");
      updatedEvent = await prisma.event.update({
        where: { id },
        data: { name }, // 名前だけ更新
        include: { range: true },
      });
    } else {
      // ゲストがいなければ通常通り全更新
      console.log("ゲストがいないため、イベント全体を更新します。");
      updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          name,
          startDate,
          endDate,
          range: {
            deleteMany: {}, // 既存 range 削除
            create: range.map((r: { startTime: string; endTime: string }) => ({
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          },
        },
        include: { range: true },
      });
    }

    // 更新後のデータ返却
    res.status(200).json({ event: updatedEvent });
  } catch (error) {
    console.error("イベント更新エラー:", error);
    res.status(500).json({ message: "イベント更新中にエラーが発生しました。" });
  }
});

router.post("/:eventId/submit", async (req: Request, res: Response) => {
  const guest = req.body;
  console.log(`イベントID: ${guest.eventId}`);
  console.log("送信されたゲスト情報:", guest);
  console.log("Cookieだよ", req.cookies);

  const parsed = GuestSchema.safeParse(guest);

  if (!parsed.success) {
    console.error("バリデーションエラー:", parsed.error);
    return res.status(400).json({
      message: "送信データの形式が不正です",
      errors: parsed.error.errors,
    });
  }

  const invalidSlots = parsed.data.slots!.filter(
    (slot: Slot) => slot.eventId !== guest.eventId
  );
  if (invalidSlots.length > 0) {
    return res
      .status(400)
      .json({ message: "一部のスロットのイベントIDが一致していません。" });
  }

  try {
    const data = await prisma.guest.create({
      data: {
        name: guest.name,
        browserId: req.cookies?.browserId,
        slots: {
          create: guest.slots.map((slot: Slot) => ({
            start: slot.start,
            end: slot.end,
            eventId: slot.eventId,
          })),
        },
        event: {
          connect: { id: guest.eventId },
        },
      },
      include: {
        slots: true,
      },
    });
    console.log("登録されたデータ:", data);
    res.cookie("browserId", data.browserId, {
      httpOnly: true, // クライアント側からアクセスさせない場合
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1年間有効
    });
    return res.status(201).json("日時が登録されました！");
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

router.put("/:eventId/submit", async (req: Request, res: Response) => {
  const guest = req.body;
  const eventId = req.params.eventId;
  const browserId = req.cookies?.browserId;

  console.log(`イベントID: ${eventId}`);
  console.log("送信されたゲスト情報:", guest);
  console.log("Cookieだよ", browserId);

  // ゲスト情報のバリデーション
  const parsed = GuestSchema.safeParse(guest);

  if (!parsed.success) {
    console.error("バリデーションエラー:", parsed.error);
    return res.status(400).json({
      message: "送信データの形式が不正です",
      errors: parsed.error.errors,
    });
  }

  try {
    // 既存のゲストを検索
    let existingGuest = await prisma.guest.findFirst({
      where: {
        eventId: eventId,
        browserId: browserId,
      },
      include: {
        slots: true,
      },
    });

    if (existingGuest) {
      // 既存ゲストがいれば更新処理
      console.log("既存ゲストを更新します。");

      // まず既存の slots を削除
      await prisma.slot.deleteMany({
        where: {
          guestId: existingGuest.id,
        },
      });

      // ゲスト情報を更新
      const updatedGuest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: {
          name: guest.name,
          slots: {
            create: guest.slots.map((slot: Slot) => ({
              start: slot.start,
              end: slot.end,
              eventId: eventId,
            })),
          },
        },

        include: {
          slots: true,
        },
      });

      return res.status(200).json({
        message: "ゲスト情報が更新されました！",
        guest: updatedGuest,
      });
    } else {
      // ゲストが存在しなければ新規作成
      console.log("新規ゲストを作成します。");

      const newGuest = await prisma.guest.create({
        data: {
          name: guest.name,
          browserId: browserId,
          slots: {
            create: guest.slots.map((slot: Slot) => ({
              start: slot.start,
              end: slot.end,
              eventId: slot.eventId,
            })),
          },
          event: {
            connect: { id: eventId },
          },
        },
        include: {
          slots: true,
        },
      });

      // Cookie をセット
      res.cookie("browserId", newGuest.browserId, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1年
      });

      return res.status(201).json({
        message: "ゲスト情報が新規作成されました！",
        guest: newGuest,
      });
    }
  } catch (error) {
    console.error("処理中のエラー:", error);
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

export default router;
