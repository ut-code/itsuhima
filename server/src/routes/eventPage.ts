import type { Context } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { ID_PATTERN } from "../lib/id.js";
import { formatDateRange, ogImageUrl } from "../lib/preview.js";
import { getEventPreview } from "../services/events.js";

/** SPA 側から index.html を取得する */
function fetchIndexHtml(c: Context<AppEnv>) {
  // `c.req.raw` だと If-None-Match 等がついており 304 Not Modified で本文なしになる可能性がある
  // それだと HTML を書き換えられないため、新しいリクエストを作っている
  return c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
}

/** `<meta property="...">` の content を書き換える */
function setMetaContent(property: string, content: string): [string, HTMLRewriterElementContentHandlers] {
  return [`meta[property="${property}"]`, { element: (el) => void el.setAttribute("content", content) }];
}

/**
 * イベントのページ (/e/:eventId)。
 * リンクのプレビューにイベント名と日程を出すため、OG のメタタグを HTMLRewriter で書き換える。
 */
export async function eventPage(c: Context<AppEnv, "/e/:eventId">) {
  const eventId = c.req.param("eventId");
  if (!ID_PATTERN.test(eventId)) {
    // 不正な eventId の場合は SPA 側に任せる (SPA 側で 404 になる)
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
}
