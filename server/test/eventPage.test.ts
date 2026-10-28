import { describe, expect, test } from "vitest";
import { createBrowser, createEvent, indexHtml, requestWorker } from "./helpers.js";

function metaContent(html: string, property: string) {
  return html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];
}

describe("GET /e/:eventId", () => {
  test("イベント名と日程を OG のメタタグに入れる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });

    const res = await requestWorker(`/e/${id}`);

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

    const html = await (await requestWorker(`/e/${id}`)).text();

    expect(metaContent(html, "og:description")).toBe("日程範囲: 2026/11/02");
  });

  test("イベント名を変えると、OG 画像の URL も変わる", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host, { name: "定例会" });
    const before = metaContent(await (await requestWorker(`/e/${id}`)).text(), "og:image");

    expect((await host.patch(`/events/${id}`, { name: "打ち上げ" })).status).toBe(200);
    const after = metaContent(await (await requestWorker(`/e/${id}`)).text(), "og:image");

    expect(after).not.toBe(before);
  });

  test("イベントが無ければ、書き換えずに返す", async () => {
    const res = await requestWorker(`/e/${"a".repeat(21)}`);

    expect(await res.text()).toBe(indexHtml);
  });

  test("イベント ID の形でなければ、書き換えずに返す", async () => {
    const res = await requestWorker("/e/short");

    expect(await res.text()).toBe(indexHtml);
  });
});
