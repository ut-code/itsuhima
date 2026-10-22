import { Hono } from "hono";
import { cors } from "hono/cors";
import { browserIdMiddleware } from "./middleware/browserId.js";
import projectsRoutes from "./routes/projects.js";
import { ServiceError, type ServiceErrorReason } from "./services/errors.js";

const allowedOrigins = process.env.CORS_ALLOW_ORIGINS?.split(",") || [];

const serviceErrorStatus = {
  project_not_found: 404,
  submission_not_found: 404,
  not_host: 403,
  already_submitted: 409,
  options_empty: 400,
  option_in_use: 400,
  invalid_slot: 400,
} as const satisfies Record<ServiceErrorReason, number>;

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
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, serviceErrorStatus[err.reason]);
    }
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof app;
