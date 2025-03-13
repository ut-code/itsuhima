import { Router, Request, Response } from "express";
import { EventSchema } from "../../../common/schema";
import { z } from "zod";
import { prisma } from "../main";

const router = Router();

// /event POST
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("⭐️⭐️⭐️⭐️⭐️⭐️", req.body);

    const parsedData = EventSchema.parse(req.body);

    const isoRanges = parsedData.range.map((r) => ({
      startTime: new Date(`${parsedData.startDate}T${r.startTime}`),
      endTime: new Date(`${parsedData.startDate}T${r.endTime}`),
    }));

    const event = await prisma.event.create({
      data: {
        name: parsedData.name,
        startDate: new Date(`${parsedData.startDate}T00:00:00`),
        endDate: new Date(`${parsedData.endDate}T23:59:59`),
        range: {
          create: isoRanges,
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

// /events/:eventId/submit POST
router.post("/:eventId/submit", (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { startDate, endDate } = req.body;

  console.log(`イベントID: ${eventId}`);
  console.log(`開始日: ${startDate}`);
  console.log(`終了日: ${endDate}`);

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "開始日と終了日は必須です。" });
  }

  if (startDate > endDate) {
    return res
      .status(400)
      .json({ message: "開始日は終了日より前にしてください。" });
  }

  return res.status(200).json({ message: "登録が完了しました！" });
});

export default router;
