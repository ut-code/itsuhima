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
  test("Cookie に Domain を付けない (画面と API が同じオリジンなので、送り先はホストだけでよい)", async () => {
    const res = await requestWithCookie();

    expect(res.headers.get("Set-Cookie")).not.toMatch(/Domain=/i);
  });

  test("署名を検証できない Cookie は、新しい browserId で発行し直す", async () => {
    const cookie = browserIdCookie(await requestWithCookie());

    const res = await requestWithCookie(`${cookie}x`);

    expect(res.status).toBe(200);
    const newCookie = browserIdCookie(res);
    expect(newCookie?.split(".")[0]).not.toBe(cookie?.split(".")[0]);
    expect((await requestWithCookie(newCookie)).status).toBe(200);
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
