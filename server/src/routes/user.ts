import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { InvolvedProjects } from "../../../common/schema";

const router = Router();
const prisma = new PrismaClient();

// TODO: rename (involvedProjects: {hostingProjects / guestingProjects} )
// /user GET
router.get("/", async (req: Request<never, InvolvedProjects, never, never>, res: Response<InvolvedProjects>) => {
  const browserId = req.cookies?.browserId;

  console.log("Cookieだよ", browserId);

  // Cookie がない場合は 401 エラー
  if (!browserId) {
    // return res.status(401).json({ message: "認証情報がありません。" }); TODO: a
    return res.status(401).json();
  }

  try {
    // Host から検索（browserId を除外）
    // const hosts = await prisma.host.findMany({
    //   where: { browserId },
    //   select: {
    //     id: true,
    //     eventId: true,
    //     event: {
    //       select: {
    //         id: true,
    //         name: true,
    //         startDate: true,
    //         endDate: true,
    //       },
    //     },
    //   },
    // });

    const hostingProjects = await prisma.event.findMany({
      where: { hosts: { some: { browserId } } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });
    
    const guestingProjects = await prisma.event.findMany({
      where: { guests: { some: { browserId } } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    // // Guest から検索（browserId を除外）
    // const guests = await prisma.guest.findMany({
    //   where: { browserId },
    //   select: {
    //     id: true,
    //     name: true,
    //     eventId: true,
    //     event: {
    //       select: {
    //         id: true,
    //         name: true,
    //         startDate: true,
    //         endDate: true,
    //       },
    //     },
    //     slots: true, // slots はそのまま返す場合
    //   },
    // });

    // // Host も Guest も両方いない場合
    // if (hosts.length === 0 && guests.length === 0) {
    //   return res
    //     .status(404)
    //     .json(); // TODO:
    //     // .json({ message: "該当するユーザーが見つかりません。" });
    // }
  
    return res.status(200).json({
      asHost: hostingProjects,
      asGuest: guestingProjects,
    });
  } catch (error) {
    console.error("ユーザー検索エラー:", error);
    return res
      .status(500)
      .json(); // TODO:
      // .json({ message: "ユーザー検索中にエラーが発生しました。" });
  }
});

export default router;
