import dotenv from "dotenv";
dotenv.config();
import express, { CookieOptions } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import projectsRoutes from "./routes/projects.js";

export const prisma = new PrismaClient();

const app = express();
const port = 3000;

const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// テスト用
app.get("/", (req, res) => {
  res.json("Hello! イツヒマ？");
});

app.use("/projects", projectsRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const isProduction = process.env.NODE_ENV === "prod";

export const cookieOptions: CookieOptions = {
  domain: process.env.DOMAIN,
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 365,
};
