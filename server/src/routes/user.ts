import { Router, Request, Response } from "express";

const router = Router();

const dummyUsers = [
  { name: "太郎", age: 18 },
  { name: "次郎", age: 15 },
];

// /user GET
router.get("/", (req: Request, res: Response) => {
  res.json(dummyUsers);
});

export default router;
