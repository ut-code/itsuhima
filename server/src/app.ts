import { Hono } from "hono";
import { cors } from "hono/cors";
import { browserIdMiddleware } from "./middleware/browserId.js";
import projectsRoutes from "./routes/projects.js";

const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

export type AppVariables = {
  browserId: string;
};

export const app = new Hono<{ Variables: AppVariables }>()
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
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof app;
