import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { InvolvedProjects } from "../../../common/schema.js";

const router = Router();
const prisma = new PrismaClient();

// 自分の browserId 　に紐付く guest または host の情報を取得
router.get("/me", async (req, res) => {
  const browserId = req.cookies?.browserId;
  if (!browserId) {
    // return res.status(401).json({ message: "認証情報がありません。" }); TODO: a
    return res.status(401).json();
  }

  try {
    // Host から検索（browserId を除外）
    const hosts = await prisma.host.findMany({
      where: { browserId },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Guest から検索（browserId を除外）
    const guests = await prisma.guest.findMany({
      where: { browserId },
      select: {
        id: true,
        name: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        slots: true, // slots はそのまま返す場合
      },
    });
    return res.status(200).json({
      hosts,
      guests,
    });
  } catch {
    return res.status(500).json();
  }
});

// TODO: rename (involvedProjects: {hostingProjects / guestingProjects} )
// /user GET
router.get(
  "/",
  async (
    req: Request<never, InvolvedProjects, never, never>,
    res: Response<InvolvedProjects>,
  ) => {
    const browserId = req.cookies?.browserId;

    if (!browserId) {
      // return res.status(401).json({ message: "認証情報がありません。" }); TODO: a
      return res.status(200).json({
        asHost: [],
      });
    }

    try {
      const hostingProjects = await prisma.project.findMany({
        where: { hosts: { some: { browserId } } },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      });

      return res.status(200).json({
        asHost: hostingProjects,
      });
    } catch (error) {
      console.error("ユーザー検索エラー:", error);
      return res.status(500).json(); // TODO:
      // .json({ message: "ユーザー検索中にエラーが発生しました。" });
    }
  },
);

export default router;
