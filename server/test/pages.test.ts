import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { app } from "../src/main.js";
import { createBrowser, createEvent } from "./helpers.js";

/** client の index.html の、OG のメタタグの部分 */
const indexHtml = `<!doctype html><html><head>
<meta property="og:title" content="イツヒマ" />
<meta property="og:description" content="既定の説明" />
<meta property="og:image" content="https://itsuhima.utcode.net/og-image.jpg" />
</head><body><div id="root"></div></body></html>`;

/** 静的アセットの代わり。どのパスにも index.html を返す (SPA のフォールバックと同じ) */
const assets = {
  fetch: async (_request: Request) =>
    new Response(indexHtml, { headers: { "Content-Type": "text/html", ETag: '"abc"' } }),
};

function requestPage(path: string, headers: Record<string, string> = {}) {
  return app.request(`https://itsuhima.example${path}`, { headers }, { ...env, ASSETS: assets });
}

function metaContent(html: string, property: string) {
  return html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];
}

describe("GET /", () => {
  test("browserId の Cookie が無ければ、ランディングページ (index.html) を返す", async () => {
    const res = await requestPage("/");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(indexHtml);
  });

  test("browserId の Cookie があれば /home にリダイレクトする", async () => {
    const res = await requestPage("/", { Cookie: "browserId=xxx" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/home");
  });
});

describe("GET /e/:eventId", () => {
  test("イベント名と日程を OG のメタタグに入れる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });

    const res = await requestPage(`/e/${id}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("ETag")).toBeNull();
    const html = await res.text();
    expect(metaContent(html, "og:title")).toBe("定例会 - イツヒマ");
    expect(metaContent(html, "og:description")).toBe("日程範囲: 2026/11/02 〜 2026/11/04");
    expect(metaContent(html, "og:image")).toMatch(new RegExp(`^https://itsuhima\\.example/og/${id}\\?v=[0-9a-f]{16}$`));
  });

  test("1 日だけのイベントは、日付を 1 つだけ出す", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { startDate: "2026-11-02", endDate: "2026-11-02" });

    const html = await (await requestPage(`/e/${id}`)).text();

    expect(metaContent(html, "og:description")).toBe("日程範囲: 2026/11/02");
  });

  test("イベント名を変えると、OG 画像の URL も変わる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });
    const before = metaContent(await (await requestPage(`/e/${id}`)).text(), "og:image");

    expect((await host.patch(`/events/${id}`, { name: "打ち上げ" })).status).toBe(200);
    const after = metaContent(await (await requestPage(`/e/${id}`)).text(), "og:image");

    expect(after).not.toBe(before);
  });

  test("イベントが無ければ、既定の OG 画像にする", async () => {
    const res = await requestPage(`/e/${"a".repeat(21)}`);

    const html = await res.text();
    expect(metaContent(html, "og:title")).toBe("イツヒマ");
    expect(metaContent(html, "og:image")).toBe("https://itsuhima.example/og-image.jpg");
  });

  test("イベント ID の形でなければ、書き換えずに返す", async () => {
    const res = await requestPage("/e/short");

    expect(await res.text()).toBe(indexHtml);
  });
});
