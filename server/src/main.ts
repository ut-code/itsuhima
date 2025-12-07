import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { customAlphabet } from "nanoid";
import { browserIdMiddleware } from "./middleware/browserId.js";
import projectsRoutes from "./routes/projects.js";

dotenv.config();

/**
 * ハイフン・アンダースコアを含まない Nano ID 形式。
 */
export const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 21);

export const prisma = new PrismaClient();

const port = Number(process.env.PORT) || 3000;
const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

export type AppVariables = {
  browserId: string;
};

const app = new Hono<{ Variables: AppVariables }>()
  .use(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  )
  .use("*", browserIdMiddleware)
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  .route("/projects", projectsRoutes);

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  },
  () => {
    console.log(`Server listening on 0.0.0.0:${port}`);
  },
);

const isProduction = process.env.NODE_ENV === "prod";

export const cookieOptions = {
  path: "/",
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365, // Express だとミリ秒だったが、Hono では秒らしい
} as const;

export type AppType = typeof app;
