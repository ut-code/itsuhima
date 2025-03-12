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

app.get("/", (req: Request, res: Response) => {
  res.json("Hello World!");
});

app.get("/users", (req: Request, res: Response) => {
  const data: User[] = dummyUsers;
  res.json(data);
});

app.get("/sample/events", async (req: Request, res: Response) => {
  const events = await prisma.event.findMany();
  res.json(events);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
