import { Hono } from "hono";
import type { AppEnv } from "./env.js";
import { api } from "./routes/api.js";
import { eventPage } from "./routes/eventPage.js";
import { landing } from "./routes/landing.js";
import { mcp } from "./routes/mcp.js";
import { oauthDiscovery } from "./routes/oauthDiscovery.js";
import { ogImage } from "./routes/ogImage.js";

/**
 * wrangler.toml の `assets` を参照。
 * 1. `run_worker_first` のいずれかに一致する場合はこの Worker に来る。
 * 2. それ以外で、`client/dist` の静的アセットに一致するものはそのまま配信される。
 * 3. それ以外は、 index.html が返る (`not_found_handling = "single-page-application"` による)。
 */
export const app = new Hono<AppEnv>()
  .get("/", landing)
  .get("/e/:eventId", eventPage)
  .get("/og/:eventId", ogImage)
  .route("/api", api)
  .route("/mcp", mcp)
  .route("/.well-known", oauthDiscovery)
  // run_worker_first にマッチしたが、上記のルートにマッチしなかった場合、SPA 側 (上記の 2. 以降) に送る
  // 例えば `/e/:eventId/edit` など。
  .notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export type { AppType } from "./routes/api.js";

export default app;
