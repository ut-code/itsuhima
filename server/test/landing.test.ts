import { describe, expect, test } from "vitest";
import { indexHtml, requestWorker } from "./helpers.js";

describe("GET /", () => {
  test("visited の Cookie が無ければ、ランディングページ (index.html) を返す", async () => {
    const res = await requestWorker("/");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(indexHtml);
  });

  test("visited の Cookie があれば /home にリダイレクトする", async () => {
    const res = await requestWorker("/", { headers: { Cookie: "visited=1" } });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/home");
  });

  test("browserId の Cookie だけでは、リダイレクトしない (本人を表す Cookie に頼らない)", async () => {
    const res = await requestWorker("/", { headers: { Cookie: "browserId=xxx" } });

    expect(res.status).toBe(200);
  });
});

describe("visited の Cookie", () => {
  test("DELETE /api/visited で消す", async () => {
    const res = await requestWorker("/api/visited", { method: "DELETE", headers: { Cookie: "visited=1" } });

    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toContainEqual(
      expect.stringMatching(/^visited=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax$/),
    );
  });

  test("API を使うと、本人を表さない visited=1 を付ける。あれば付け直さない", async () => {
    const res = await requestWorker("/api");

    expect(res.headers.get("Set-Cookie")).toMatch(/^visited=1; Max-Age=31536000; Path=\/; HttpOnly; SameSite=Lax$/);
    const again = await requestWorker("/api", { headers: { Cookie: "visited=1" } });
    expect(again.headers.get("Set-Cookie")).toBeNull();
  });
});
