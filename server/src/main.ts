import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";

import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
// import cookieParser from "cookie-parser";
// import cors from "cors";
// import express, { type CookieOptions } from "express";
import projectsRoutes from "./routes/projects.js";

export const prisma = new PrismaClient();

// const app = express();
const app = new Hono();
const port = process.env.PORT || 3000;

const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// app.use(cookieParser(process.env.COOKIE_SECRET));

app.get("/", (c) => {
  return c.json({ message: "Hello! イツヒマ？" });
});

// app.route("/projects", projectsRoutes); // TODO: projectsRoutes を Hono に対応させる

// app.listen(Number(port), "0.0.0.0", () => {
//   console.log(`Server listening on 0.0.0.0:${port}`);
// });

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
