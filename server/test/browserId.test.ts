import { describe, expect, test, vi } from "vitest";
import { app } from "../src/app.js";

function browserIdCookie(res: Response) {
  return res.headers.get("Set-Cookie")?.split(";")[0];
}

function requestWithCookie(cookie?: string) {
  return app.request("/", { headers: cookie ? { Cookie: cookie } : {} });
}

describe("browserIdMiddleware", () => {
  test("署名が不正な Cookie には 400 を返す", async () => {
    const cookie = browserIdCookie(await requestWithCookie());

    const res = await requestWithCookie(`${cookie}x`);

    expect(res.status).toBe(400);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("前の鍵で署名された Cookie は、同じ browserId を現行の鍵で署名し直して発行する", async () => {
    vi.stubEnv("COOKIE_SECRET", "old-secret");
    const oldCookie = browserIdCookie(await requestWithCookie());
    vi.stubEnv("COOKIE_SECRET", "new-secret");
    vi.stubEnv("COOKIE_SECRET_PREVIOUS", "older-secret, old-secret");

    const res = await requestWithCookie(oldCookie);

    expect(res.status).toBe(200);
    const newCookie = browserIdCookie(res);
    expect(newCookie).not.toBe(oldCookie);
    expect(newCookie?.split(".")[0]).toBe(oldCookie?.split(".")[0]);

    // 署名し直した Cookie は、前の鍵を外しても通る
    vi.stubEnv("COOKIE_SECRET_PREVIOUS", undefined);
    expect((await requestWithCookie(newCookie)).status).toBe(200);
  });
});
