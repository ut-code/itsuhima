import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { EventSchema } from "../../common/schema";
import { z } from "zod";

const prisma = new PrismaClient();

const dummyUsers = [
  {
    name: "太郎",
    age: 18,
  },
  {
    name: "次郎",
    age: 15,
  },
];

const app = express();
const port = 3000;

app.use(cors()); // TODO: configure
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json("Hello World!");
});

app.post("/event", async (req: Request, res: Response) => {
  try {
    // バリデーション
    console.log("⭐️⭐️⭐️⭐️⭐️⭐️", req.body);

    const parsedData = EventSchema.parse(req.body);

    const isoRanges = parsedData.range.map((r) => ({
      startTime: new Date(`${parsedData.startDate}T${r.startTime}`), // "2025-03-13T16:11:00"
      endTime: new Date(`${parsedData.startDate}T${r.endTime}`),
    }));

    // ✅ Prisma で作成
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

    res.status(201).json({
      event,
    });
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

app.post("/events/:eventId/submit", (req, res) => {
  const { eventId } = req.params;
  const { startDate, endDate } = req.body;

  console.log(`イベントID: ${eventId}`);
  console.log(`開始日: ${startDate}`);
  console.log(`終了日: ${endDate}`);

  // バリデーション例
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "開始日と終了日は必須です。" });
  }

  if (startDate > endDate) {
    return res
      .status(400)
      .json({ message: "開始日は終了日より前にしてください。" });
  }

  // 仮にDB保存処理があるとしたらここ（今は仮でconsole出力）

  // 成功レスポンス
  return res.status(200).json({ message: "登録が完了しました！" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
