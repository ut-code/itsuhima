import { describe, expect, test } from "vitest";
import { indexHtml, requestWorker } from "./helpers.js";

describe("GET /", () => {
  test("browserId の Cookie が無ければ、ランディングページ (index.html) を返す", async () => {
    const res = await requestWorker("/");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(indexHtml);
  });

  test("browserId の Cookie があれば /home にリダイレクトする", async () => {
    const res = await requestWorker("/", { headers: { Cookie: "browserId=xxx" } });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/home");
  });
});
