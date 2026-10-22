import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { formatDateRange, ogImageUrl } from "../lib/preview.js";
import { getEventPreview } from "../services/events.js";

/** イベント ID (nanoid 21 文字) の形 */
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

/** SPA の index.html。条件付きリクエスト (304) にならないよう、元のリクエストのヘッダは渡さない */
function fetchIndexHtml(c: { env: AppEnv["Bindings"]; req: { url: string } }) {
  return c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
}

/** `<meta property="...">` の content を書き換える */
function setMetaContent(property: string, content: string): [string, HTMLRewriterElementContentHandlers] {
  return [`meta[property="${property}"]`, { element: (el) => void el.setAttribute("content", content) }];
}

/** SPA のページのうち、Worker で手を加えるもの */
const pages = new Hono<AppEnv>()
  // 使ったことがある (browserId の Cookie がある) なら、ランディングページではなく /home を開く
  .get("/", (c) => {
    if (getCookie(c, "browserId") !== undefined) {
      return c.redirect("/home", 302);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  })

  // イベントのページ。リンクのプレビューにイベント名と日程を出すため、OG のメタタグを書き換える
  .get("/e/:eventId", async (c) => {
    const eventId = c.req.param("eventId");
    if (!EVENT_ID_PATTERN.test(eventId)) {
      return c.env.ASSETS.fetch(c.req.raw);
    }

    const [html, event] = await Promise.all([fetchIndexHtml(c), getEventPreview(createDb(c.env.DB), eventId)]);
    const origin = new URL(c.req.url).origin;

    const rewriter = new HTMLRewriter();
    if (event) {
      rewriter
        .on(...setMetaContent("og:title", `${event.name} - イツヒマ`))
        .on(...setMetaContent("og:description", `日程範囲: ${formatDateRange(event)}`))
        .on(...setMetaContent("og:image", await ogImageUrl(origin, event)));
    } else {
      rewriter.on(...setMetaContent("og:image", `${origin}/og-image.jpg`));
    }

    const res = rewriter.transform(html);
    const headers = new Headers(res.headers);
    // 書き換えたので、元の HTML の ETag は使えない
    headers.delete("ETag");
    headers.set("X-Robots-Tag", "noindex");
    return new Response(res.body, { status: res.status, headers });
  });

export default pages;
