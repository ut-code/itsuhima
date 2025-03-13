import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import eventRoutes from "./routes/event";
import userRoutes from "./routes/user";

export const prisma = new PrismaClient();

const app = express();
const port = 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
); // TODO: configure
app.use(express.json());
app.use(cookieParser());

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
