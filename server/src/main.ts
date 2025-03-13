import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import { User } from "../../common/schema";
import { PrismaClient } from "@prisma/client";

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

app.get("/sample/events", async (req: Request, res: Response) => {
  const events = await prisma.event.findMany();
  res.json(events);
});

app.post("/event", (req: Request, res: Response) => {
  res.json("イベントを作成しました");
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

app.get("/users", (req: Request, res: Response) => {
  const data: User[] = dummyUsers;
  res.json(data);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
