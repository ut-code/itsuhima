import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import type { Bindings } from "../src/env.js";
import { app } from "../src/main.js";

function browserIdCookie(res: Response) {
  return res.headers.get("Set-Cookie")?.split(";")[0];
}

function requestWithCookie(cookie?: string, vars: Partial<Bindings> = {}) {
  return app.request("/api", { headers: cookie ? { Cookie: cookie } : {} }, { ...env, ...vars });
}

describe("browserIdMiddleware", () => {
  test("署名が不正な Cookie には 400 を返す", async () => {
    const cookie = browserIdCookie(await requestWithCookie());

    const res = await requestWithCookie(`${cookie}x`);

    expect(res.status).toBe(400);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("前の鍵で署名された Cookie は、同じ browserId を現行の鍵で署名し直して発行する", async () => {
    const oldCookie = browserIdCookie(await requestWithCookie(undefined, { COOKIE_SECRET: "old-secret" }));

    const res = await requestWithCookie(oldCookie, {
      COOKIE_SECRET: "new-secret",
      COOKIE_SECRET_PREVIOUS: "older-secret, old-secret",
    });

    expect(res.status).toBe(200);
    const newCookie = browserIdCookie(res);
    expect(newCookie).not.toBe(oldCookie);
    expect(newCookie?.split(".")[0]).toBe(oldCookie?.split(".")[0]);

    // 署名し直した Cookie は、前の鍵を外しても通る
    expect((await requestWithCookie(newCookie, { COOKIE_SECRET: "new-secret" })).status).toBe(200);
  });
});
