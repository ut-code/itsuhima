import { Hono } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { actorMiddleware } from "../middleware/actor.js";
import { browserIdMiddleware } from "../middleware/browserId.js";
import { ServiceError, type ServiceErrorReason } from "../services/errors.js";
import eventsRoutes from "./events.js";

const serviceErrorStatus = {
  event_not_found: 404,
  submission_not_found: 404,
  not_host: 403,
  already_submitted: 409,
  version_conflict: 409,
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
  // ログイン (Better Auth)。Google の OAuth、セッションなど
  .on(["GET", "POST"], "/auth/*", async (c) => {
    // Better Auth は初期化が重いので、使うときだけ初期化する (ほかのリクエストのコールドスタートを遅くしない)
    const { createAuth } = await import("../auth.js");
    return createAuth(c.env, c.get("db"), { browserId: c.get("browserId") }).handler(c.req.raw);
  })
  // ここから下のルートは、操作する本人 (actor) を使う
  .use("*", actorMiddleware)
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
