import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// /user GET
router.get("/", async (req: Request, res: Response) => {
  const browserId = req.cookies?.browserId;

  console.log("Cookieだよ", browserId);

  // Cookie がない場合は 401 エラー
  if (!browserId) {
    return res.status(401).json({ message: "認証情報がありません。" });
  }

  try {
    // Host から検索
    const hosts = await prisma.host.findMany({
      where: { browserId },
      include: { event: true }, // 必要に応じて関連情報も
    });

    // Guest から検索
    const guests = await prisma.guest.findMany({
      where: { browserId },
      include: { event: true }, // 必要に応じて関連情報も
    });
    if (!hosts && !guests) {
      // Host も Guest も見つからなければ 404
      return res
        .status(404)
        .json({ message: "該当するユーザーが見つかりません。" });
    }
    return res.status(201).json({ hosts, guests });
  } catch (error) {
    console.error("ユーザー検索エラー:", error);
    return res
      .status(500)
      .json({ message: "ユーザー検索中にエラーが発生しました。" });
  }
});

export default router;
