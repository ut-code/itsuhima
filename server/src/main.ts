import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import projectsRoutes from "./routes/projects.js";
import usersRoutes from "./routes/users.js";

export const prisma = new PrismaClient();

const app = express();
const port = 3000;

const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
); // TODO: configure
app.use(express.json());
app.use(cookieParser());

// テスト用
app.get("/", (req, res) => {
  res.json("Hello World!");
});

app.use("/projects", projectsRoutes);
app.use("/users", usersRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
