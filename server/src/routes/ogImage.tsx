import type { Context } from "hono";
import { createDb } from "../db/index.js";
import type { AppEnv } from "../env.js";
import { type EventPreview, formatDateRange, ogImageVersion } from "../lib/preview.js";
import { getEventPreview } from "../services/events.js";

const FONT_URL = "https://unpkg.com/@fontsource/m-plus-1p@5.2.8/files/m-plus-1p-japanese-700-normal.woff";

// isolate が生きている間は使い回す
let font: Promise<ArrayBuffer> | undefined;

function loadFont() {
  font ??= fetch(FONT_URL).then((res) => {
    if (!res.ok) throw new Error(`フォントを取得できませんでした: ${res.status}`);
    return res.arrayBuffer();
  });
  // 失敗したら、次のリクエストで取り直す
  font.catch(() => {
    font = undefined;
  });
  return font;
}

/** 表示幅 (ASCII は 1、それ以外は 2) が maxWidth を超えたら切って「…」を付ける */
function truncateByWidth(text: string, maxWidth: number) {
  let width = 0;
  let result = "";
  for (const char of text) {
    const charWidth = char.charCodeAt(0) < 128 ? 1 : 2;
    if (width + charWidth > maxWidth) {
      return `${result}…`;
    }
    width += charWidth;
    result += char;
  }
  return result;
}

function OgCard({ event }: { event: EventPreview }) {
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: "#0f82b1",
        padding: "48px 56px",
        width: "100%",
        height: "100%",
        fontFamily: "M PLUS 1p",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          display: "flex",
          backgroundColor: "#fff",
          color: "#555",
          flexDirection: "column",
          borderRadius: "32px",
          flex: 1,
          alignItems: "center",
          padding: "40px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "64px", textAlign: "center", wordBreak: "break-word" }}>
            {truncateByWidth(event.name, 72)}
          </span>
          <span style={{ fontSize: "40px", textAlign: "center" }}>{formatDateRange(event)}</span>
        </div>
        <div style={{ color: "#0f82b1", display: "flex", alignItems: "center", gap: "8px", fontSize: "40px" }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
          >
            <rect x="34" width="16" height="33" rx="2" fill="#0F82B1" />
            <rect y="17" width="33" height="16" rx="2" fill="#0F82B1" />
            <rect x="17" y="34" width="16" height="16" rx="2" fill="#0F82B1" />
          </svg>
          <div>イツヒマ</div>
        </div>
      </div>
    </div>
  );
}

/**
 * イベントの OG 画像 (/og/:eventId)。URL の `?v=` (内容から作った版) ごとに Cache API にキャッシュする。
 * 生成は CPU 時間を多く使うので (1 枚 100ms 前後)、同じ画像は作り直さない。
 */
export async function ogImage(c: Context<AppEnv, "/og/:eventId">) {
  // Workers の caches.default (型は DOM の CacheStorage に隠れて見えない)
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(c.req.url);
  if (cached) {
    return cached;
  }

  const eventId = c.req.param("eventId");
  const event = await getEventPreview(createDb(c.env.DB), eventId);
  if (!event) {
    return c.redirect("/og-image.jpg", 302);
  }

  // 版が古い・無いときは、今の版の URL に転送する (キャッシュするのは今の版の URL だけ)
  const version = await ogImageVersion(event);
  if (c.req.query("v") !== version) {
    return c.redirect(`/og/${event.id}?v=${version}`, 302);
  }

  // 画像の生成 (Satori と resvg の wasm) は初期化が重いので、作るときだけ読み込む。ほかのリクエストのコールドスタートを遅くしない
  const { ImageResponse } = await import("@cloudflare/pages-plugin-vercel-og/api");
  const image = new ImageResponse(<OgCard event={event} />, {
    width: 1200,
    height: 630,
    fonts: [{ name: "M PLUS 1p", data: await loadFont(), weight: 700, style: "normal" }],
  });
  const res = new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      // 版ごとに内容は変わらない
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
    },
  });
  c.executionCtx.waitUntil(cache.put(c.req.url, res.clone()));
  return res;
}
