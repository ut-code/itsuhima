import { env } from "cloudflare:workers";
import { serializeSigned } from "hono/utils/cookie";
import { app } from "../src/app.js";

/**
 * 1 つのブラウザを再現する。browserId を決めて署名済みの Cookie を作り、すべてのリクエストに付ける。
 * サーバーは同じ browserId で Cookie を再発行するだけなので、レスポンスの Set-Cookie は見ない。
 */
export function createBrowser() {
  const browserId = crypto.randomUUID();
  // 署名は非同期なので、最初のリクエストのときに作る
  let cookie: Promise<string> | undefined;

  const request = async (path: string, init: RequestInit = {}) => {
    cookie ??= serializeSigned("browserId", browserId, env.COOKIE_SECRET);
    const headers = new Headers(init.headers);
    headers.set("Cookie", await cookie);
    return app.request(path, { ...init, headers }, env);
  };
  const send = (method: string, path: string, body?: unknown) =>
    request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    browserId,
    get: (path: string) => request(path),
    post: (path: string, body?: unknown) => send("POST", path, body),
    put: (path: string, body?: unknown) => send("PUT", path, body),
    patch: (path: string, body?: unknown) => send("PATCH", path, body),
    delete: (path: string) => send("DELETE", path),
  };
}

export type Browser = ReturnType<typeof createBrowser>;

/**
 * 2026/11/02〜11/04 (JST)、08:00〜23:00 のイベント。
 */
export function projectInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "テストイベント",
    description: "説明",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
    participationOptions: [{ id: crypto.randomUUID(), label: "参加", color: "#0F82B1" }],
    ...overrides,
  };
}

/** イベントを作成して、その id と参加形態の id を返す */
export async function createProject(host: Browser, overrides: Record<string, unknown> = {}) {
  const input = projectInput(overrides);
  const res = await host.post("/projects", input);
  if (res.status !== 201) throw new Error(`イベントの作成に失敗しました: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  return { id, input, optionId: input.participationOptions[0].id };
}

/** 2026/11/02 (JST) 10:00〜12:00 */
export const slotOnNov2 = { startAt: "2026-11-02T01:00:00.000Z", endAt: "2026-11-02T03:00:00.000Z" };

export function submissionInput(optionId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "ゲスト",
    comment: "コメント",
    slots: [{ ...slotOnNov2, optionId }],
    ...overrides,
  };
}
