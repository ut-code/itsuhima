import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { InvolvedProjects } from "../../../common/schema.js";

const router = Router();
const prisma = new PrismaClient();

// TODO: rename (involvedProjects: {hostingProjects / guestingProjects} )
// projects/mine でいいかも
// /user GET
router.get(
  "/",
  async (req: Request<never, InvolvedProjects, never, never>, res: Response<InvolvedProjects>) => {
    const browserId = req.cookies?.browserId;

    if (!browserId) {
      // return res.status(401).json({ message: "認証情報がありません。" }); TODO: a
      return res.status(200).json([]);
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
            }
          }
        },
      });

      return res.status(200).json(involvedProjects.map(
        (p) => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate,
          endDate: p.endDate,
          isHost: p.hosts.some((host) => host.browserId === browserId),
        })
      ));
    } catch (error) {
      console.error("ユーザー検索エラー:", error);
      return res.status(500).json(); // TODO:
      // .json({ message: "ユーザー検索中にエラーが発生しました。" });
    }
  }
);

export default router;
