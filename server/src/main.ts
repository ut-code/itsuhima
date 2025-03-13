import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import eventRoutes from "./routes/event";
import userRoutes from "./routes/user";

export const prisma = new PrismaClient();

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

// テスト用
app.get("/", (req, res) => {
  res.json("Hello World!");
});

// ルート分割
app.use("/event", eventRoutes);
app.use("/user", userRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
