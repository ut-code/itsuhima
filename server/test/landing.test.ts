import { describe, expect, test } from "vitest";
import { createEvent, eventInput, indexHtml, requestWorker, submissionInput } from "./helpers.js";

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

  test("ログインしていれば (セッションの Cookie があれば)、visited が無くても /home にリダイレクトする", async () => {
    for (const name of ["better-auth.session_token", "__Secure-better-auth.session_token"]) {
      const res = await requestWorker("/", { headers: { Cookie: `${name}=xxx` } });

      expect(res.status, name).toBe(302);
      expect(res.headers.get("Location")).toBe("/home");
    }
  });

  test("browserId の Cookie だけでは、リダイレクトしない (本人を表す Cookie に頼らない)", async () => {
    const res = await requestWorker("/", { headers: { Cookie: "browserId=xxx" } });

    expect(res.status).toBe(200);
  });
});

const VISITED_SET_COOKIE = /^visited=1; Max-Age=31536000; Path=\/; HttpOnly; SameSite=Lax$/;

function postJson(path: string, body: unknown, cookie?: string) {
  return requestWorker(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("visited の Cookie", () => {
  test("DELETE /api/visited で消す", async () => {
    const res = await requestWorker("/api/visited", { method: "DELETE", headers: { Cookie: "visited=1" } });

    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toContainEqual(
      expect.stringMatching(/^visited=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax$/),
    );
  });

  test("イベントを作ると、本人を表さない visited=1 を付ける。あれば付け直さない", async () => {
    const res = await postJson("/api/events", eventInput());

    expect(res.status).toBe(201);
    expect(res.headers.get("Set-Cookie")).toMatch(VISITED_SET_COOKIE);
    const again = await postJson("/api/events", eventInput(), "visited=1");
    expect(again.headers.get("Set-Cookie")).toBeNull();
  });

  test("回答すると、visited=1 を付ける", async () => {
    const { id, optionId } = await createEvent();

    const res = await postJson(`/api/events/${id}/participants`, submissionInput(optionId));

    expect(res.status).toBe(201);
    expect(res.headers.get("Set-Cookie")).toMatch(VISITED_SET_COOKIE);
  });

  test("編集・削除・戻すでも付ける", async () => {
    const { id } = await createEvent();
    const requests: [string, string, unknown?][] = [
      ["PATCH", `/api/events/${id}`, { name: "変更" }],
      ["DELETE", `/api/events/${id}`],
      ["POST", `/api/events/${id}/restore`],
    ];

    for (const [method, path, body] of requests) {
      const res = await requestWorker(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(res.ok, `${method} ${path}`).toBe(true);
      expect(res.headers.get("Set-Cookie"), `${method} ${path}`).toMatch(VISITED_SET_COOKIE);
    }
  });

  test("失敗したときは付けない", async () => {
    const res = await postJson("/api/events", { name: "" });

    expect(res.status).toBe(400);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  test("読むだけの API (ログインの状態、イベントの取得・一覧・履歴) では付けない", async () => {
    const { id } = await createEvent();

    for (const path of [
      "/api/auth/get-session",
      `/api/events/${id}`,
      `/api/events?ids=${id}`,
      `/api/events/${id}/history`,
      "/api/me/events",
      "/api",
    ]) {
      const res = await requestWorker(path);
      expect(res.headers.get("Set-Cookie") ?? "", path).not.toMatch(/visited=/);
    }
  });
});
