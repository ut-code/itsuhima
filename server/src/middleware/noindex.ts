import { createMiddleware } from "hono/factory";
import type { AppEnv, Bindings } from "../env.js";

/** 検索に載せないパスの前置き。イベントのページ (`/e/:eventId/edit` なども) と OG 画像 */
const NOINDEX_PREFIXES = ["/e/", "/og/"];

function isNoindex(env: Bindings, path: string) {
  return env.NOINDEX === "true" || NOINDEX_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * 検索に載せないレスポンスに `X-Robots-Tag: noindex` を付ける。
 * Worker を通らない静的アセット (`/login` など) には付かないので、そちらは `client/public/_headers` で付ける。
 */
export const noindexMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (isNoindex(c.env, new URL(c.req.url).pathname)) {
    // ASSETS.fetch が返す Response のヘッダは変更できないので、作り直す
    c.res = new Response(c.res.body, c.res);
    c.res.headers.set("X-Robots-Tag", "noindex");
  }
});
