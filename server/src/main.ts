import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { browserIdMiddleware } from "./middleware/browserId.js";
import projectsRoutes from "./routes/projects.js";
import { UseCaseError } from "./usecases/types.js";

dotenv.config();

export { cookieOptions } from "./config.js";
export { prisma } from "./db.js";
export { nanoid } from "./lib/id.js";

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
  .route("/projects", projectsRoutes)
  .onError((err, c) => {
    if (err instanceof UseCaseError) {
      return c.json({ message: err.message }, err.status);
    }
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

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

export type AppType = typeof app;
