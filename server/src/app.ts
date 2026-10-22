import { Hono } from "hono";
import { createDb } from "./db/index.js";
import type { AppEnv } from "./env.js";
import { browserIdMiddleware } from "./middleware/browserId.js";
import eventsRoutes from "./routes/events.js";
import { ServiceError, type ServiceErrorReason } from "./services/errors.js";

const serviceErrorStatus = {
  event_not_found: 404,
  submission_not_found: 404,
  not_host: 403,
  already_submitted: 409,
  options_empty: 400,
  option_in_use: 400,
  invalid_slot: 400,
} as const satisfies Record<ServiceErrorReason, number>;

/** Web UI 用の API。`/api` の下に置く。client は Hono RPC で `AppType` を使って呼ぶ */
export const api = new Hono<AppEnv>()
  .use("*", browserIdMiddleware)
  .use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  })
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  .route("/events", eventsRoutes)
  .onError((err, c) => {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, serviceErrorStatus[err.reason]);
    }
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof api;

export const app = new Hono<AppEnv>().route("/api", api);
