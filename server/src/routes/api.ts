import { Hono } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { actorMiddleware } from "../middleware/actor.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.js";
import { visitedMiddleware } from "../middleware/visited.js";
import { ServiceError, type ServiceErrorReason } from "../services/errors.js";
import { authHandler } from "./auth.js";
import eventsRoutes from "./events.js";
import legacyRoutes from "./legacy.js";
import meRoutes from "./me.js";

const serviceErrorStatus = {
  event_not_found: 404,
  event_deleted: 410,
  participant_not_found: 404,
  history_not_found: 404,
  forbidden: 403,
  already_submitted: 409,
  options_empty: 400,
  option_in_use: 400,
  invalid_slot: 400,
} as const satisfies Record<ServiceErrorReason, number>;

/** Web UI 用の API。`/api` の下に置く。client は Hono RPC で `AppType` を使って呼ぶ */
export const api = new Hono<AppEnv>()
  .use("*", async (c, next) => {
    await next();
    // ブラウザにキャッシュさせない。410 (削除したイベント) などは、指定が無いとキャッシュされ、戻したあとも古い応答が出る
    c.header("Cache-Control", "no-store");
  })
  .use("*", visitedMiddleware)
  .use("*", async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  })
  .use("*", actorMiddleware)
  // ログインした人はユーザーごと、していない人は IP ごと
  .use("*", rateLimitMiddleware)
  .get("/", (c) => {
    return c.json({ message: "Hello! イツヒマ？" });
  })
  // ログイン (Google) と、MCP クライアント向けの OAuth の認可サーバー (Better Auth)
  .on(["GET", "POST"], "/auth/*", authHandler)
  .route("/events", eventsRoutes)
  .route("/me", meRoutes)
  .route("/legacy", legacyRoutes)
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
