import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db/index.js";
import type { AppEnv } from "./env.js";
import { browserIdMiddleware } from "./middleware/browserId.js";
import projectsRoutes from "./routes/projects.js";
import { ServiceError, type ServiceErrorReason } from "./services/errors.js";

const serviceErrorStatus = {
  project_not_found: 404,
  submission_not_found: 404,
  not_host: 403,
  already_submitted: 409,
  options_empty: 400,
  option_in_use: 400,
  invalid_slot: 400,
} as const satisfies Record<ServiceErrorReason, number>;

export const app = new Hono<AppEnv>()
  .use(
    "*",
    cors({
      origin: (origin, c) => ((c.env.CORS_ALLOW_ORIGINS?.split(",") ?? []).includes(origin) ? origin : null),
      credentials: true,
    }),
  )
  .use("*", browserIdMiddleware)
  .use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  })
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  .route("/projects", projectsRoutes)
  .onError((err, c) => {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, serviceErrorStatus[err.reason]);
    }
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof app;
