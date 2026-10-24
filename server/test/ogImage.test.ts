import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { app } from "../src/main.js";
import { createBrowser, createEvent } from "./helpers.js";

// 画像の生成は、フォントの取得に外部への通信が要るのでテストしない。Cache API もテストの実行環境では効かない。
// どちらもローカルの wrangler dev で確かめる

const origin = "https://itsuhima.example";

async function requestOgImage(path: string) {
  const ctx = createExecutionContext();
  const res = await app.request(`${origin}${path}`, {}, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("GET /og/:eventId", () => {
  test("イベントが無ければ、既定の OG 画像に転送する", async () => {
    const res = await requestOgImage(`/og/${"a".repeat(21)}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/og-image.jpg");
  });

  test("版 (?v=) が無い・古いときは、今の版の URL に転送する", async () => {
    const host = createBrowser();
    const { id } = await createEvent(host);

    const res = await requestOgImage(`/og/${id}`);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location");
    expect(location).toMatch(new RegExp(`^/og/${id}\\?v=[0-9a-f]{16}$`));

    const stale = await requestOgImage(`/og/${id}?v=0000000000000000`);
    expect(stale.status).toBe(302);
    expect(stale.headers.get("Location")).toBe(location);
  });
});
