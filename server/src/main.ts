import { Hono } from "hono";
import { api } from "./app.js";
import type { AppEnv } from "./env.js";
import pages from "./routes/pages.js";

/**
 * Worker の入口。静的アセットは Worker を通らずに配信され (wrangler.toml の `assets`)、
 * `run_worker_first` に当たったリクエストだけがここに来る。
 */
export const app = new Hono<AppEnv>()
  .route("/api", api)
  .route("/", pages)
  .notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ message: "Not Found" }, 404);
    }
    // ページ (SPA) のパス。静的アセットから返す (無いパスは index.html になる)
    return c.env.ASSETS.fetch(c.req.raw);
  });

export type { AppType } from "./app.js";

export default app;
