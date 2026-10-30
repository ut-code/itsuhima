import { Hono } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { browserIdMiddleware } from "../middleware/browserId.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.js";
import { ServiceError, type ServiceErrorReason } from "../services/errors.js";
import eventsRoutes from "./events.js";

const serviceErrorStatus = {
  event_not_found: 404,
  event_deleted: 410,
  submission_not_found: 404,
  history_not_found: 404,
  not_host: 403,
  not_participant: 403,
  already_submitted: 409,
  options_empty: 400,
  option_in_use: 400,
  invalid_slot: 400,
} as const satisfies Record<ServiceErrorReason, number>;

/** Web UI 用の API。`/api` の下に置く。client は Hono RPC で `AppType` を使って呼ぶ */
export const api = new Hono<AppEnv>()
  .use("*", rateLimitMiddleware)
  .use("*", browserIdMiddleware)
  .use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    c.set("actor", { browserId: c.get("browserId") });
    await next();
  })
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  .route("/events", eventsRoutes)
  // `/api` の下に未定義のパスは、画面 (index.html) に落とさず 404 にする
  .all("*", (c) => c.json({ message: "Not Found" }, 404))
  .onError((err, c) => {
    if (err instanceof ServiceError) {
      return c.json({ message: err.message }, serviceErrorStatus[err.reason]);
    }
    console.error(err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof api;
