import { Hono } from "hono";
import { api } from "./app.js";
import type { AppEnv } from "./env.js";
import oauthDiscovery from "./routes/oauthDiscovery.js";
import pages from "./routes/pages.js";

/**
 * Worker の入口。静的アセットは Worker を通らずに配信され (wrangler.toml の `assets`)、
 * `run_worker_first` に当たったリクエストだけがここに来る。
 */
export const app = new Hono<AppEnv>()
  .route("/api", api)
  .route("/", pages)
  .route("/", oauthDiscovery)
  // OG 画像の生成 (wasm など) は重いので、/og に来たときだけ読み込む。ほかのリクエストのコールドスタートを遅くしない
  .get("/og/:eventId", async (c) => {
    const { default: ogImage } = await import("./routes/ogImage.js");
    return ogImage.fetch(c.req.raw, c.env, c.executionCtx);
  })
  .notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ message: "Not Found" }, 404);
    }
    // ページ (SPA) のパス。静的アセットから返す (無いパスは index.html になる)
    return c.env.ASSETS.fetch(c.req.raw);
  });

export type { AppType } from "./app.js";

export default app;
