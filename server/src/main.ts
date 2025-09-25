import { serve } from "@hono/node-server";
import { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import projectsRoutes from "./routes/projects.js";

import dotenv from "dotenv";
dotenv.config();

export const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

const app = new Hono()
  .use(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  )
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  .route("/projects", projectsRoutes);

serve(
  {
    fetch: app.fetch,
    port: Number(port),
    hostname: "0.0.0.0",
  },
  () => {
    console.log(`Server listening on 0.0.0.0:${port}`);
  },
);

const isProduction = process.env.NODE_ENV === "prod";

export const cookieOptions = {
  domain: process.env.DOMAIN,
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 60 * 60 * 24 * 365, // Express だとミリ秒だったが、Hono では秒らしい
} as const;

export type AppType = typeof app;
