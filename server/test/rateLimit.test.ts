import { describe, expect, test } from "vitest";
import { eventInput, requestWorker } from "./helpers.js";

function postEvent(ip?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (ip) headers.set("CF-Connecting-IP", ip);
  return requestWorker("/api/events", { method: "POST", headers, body: JSON.stringify(eventInput()) });
}

describe("書き込みのレート制限", () => {
  test("同じ IP から 1 分に 60 回を超えて書き込むと 429。ほかの IP と読み込みは制限しない", async () => {
    const ip = "192.0.2.1";
    for (let i = 0; i < 60; i++) {
      expect((await postEvent(ip)).status).toBe(201);
    }

    const res = await postEvent(ip);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ message: "操作が多すぎます。しばらく待ってからやり直してください。" });
    expect((await postEvent("192.0.2.2")).status).toBe(201);
    const read = await requestWorker("/api", { headers: { "CF-Connecting-IP": ip } });
    expect(read.status).toBe(200);
  });

  test("IP が無ければ制限しない", async () => {
    for (let i = 0; i < 61; i++) {
      expect((await postEvent()).status).toBe(201);
    }
  });
});
