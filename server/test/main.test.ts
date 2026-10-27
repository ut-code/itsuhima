import { describe, expect, test } from "vitest";
import { indexHtml, requestWorker } from "./helpers.js";

describe("ルートが無いパス", () => {
  test("/api の下は、画面 (index.html) ではなく 404 の JSON を返す", async () => {
    for (const [path, method] of [
      ["/api/unknown", "GET"],
      ["/api/events/x/y/z", "GET"],
      ["/api", "POST"],
    ]) {
      const res = await requestWorker(path, { method });

      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toEqual({ message: "Not Found" });
    }
  });

  test("/api の外は、静的アセットに任せる", async () => {
    const res = await requestWorker("/e/a/b");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(indexHtml);
  });
});
