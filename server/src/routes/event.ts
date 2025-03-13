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
// /event POST
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
      },
      include: { range: true },
    });

    res.status(201).json({ event });
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

// 特定のイベント取得
router.get("/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const id = idSchema.parse(eventId);

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { range: true, guests: true, slots: true },
    });

    // イベントが存在しない場合
    if (!event) {
      return res
        .status(404)
        .json({ message: "指定されたイベントが見つかりません。" });
    }

    // 成功レスポンス
    res.status(200).json({ event });
  } catch (error) {
    console.error("イベント取得エラー:", error);
    res.status(500).json({ message: "イベント取得中にエラーが発生しました。" });
  }
});
router.post("/:eventId/submit", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const guest = req.body;

  console.log(`イベントID: ${eventId}`);
  console.log("送信されたゲスト情報:", guest);

  // ✅ Zodによるバリデーション
  const parsed = GuestSchema.safeParse(guest);

  if (!parsed.success) {
    console.error("バリデーションエラー:", parsed.error);
    return res.status(400).json({
      message: "送信データの形式が不正です",
      errors: parsed.error.errors,
    });
  }

  // ✅ もしeventIdとslot.eventIdが一致しているかチェックする場合
  const invalidSlots = parsed.data.slots!.filter(
    (slot) => slot.eventId !== eventId
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
        eventId: eventId,
        browserId: guest.browserId,
        slots: {
          create: guest.slots.map((slot: Slot) => ({
            start: slot.start,
            end: slot.end,
            eventId: slot.eventId,
          })),
        },
      },
      include: {
        slots: true,
      },
    });
    console.log("登録されたデータ:", data);
    return res.status(201).json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

export default router;
