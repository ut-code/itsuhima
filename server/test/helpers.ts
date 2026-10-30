import { env } from "cloudflare:workers";
import { app } from "../src/main.js";

/**
 * API を呼ぶ。サーバーはブラウザを識別しないので、Cookie は付けない。
 * パスは API の `/api` を除いたもの (`/events` など) を渡す。
 */
const request = (path: string, init: RequestInit = {}) => app.request(`/api${path}`, init, env);
const send = (method: string, path: string, body?: unknown) =>
  request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const api = {
  get: (path: string, init?: RequestInit) => request(path, init),
  post: (path: string, body?: unknown) => send("POST", path, body),
  put: (path: string, body?: unknown) => send("PUT", path, body),
  patch: (path: string, body?: unknown) => send("PATCH", path, body),
  delete: (path: string) => send("DELETE", path),
};

/**
 * 2026/11/02〜11/04 (JST)、08:00〜23:00 のイベント。
 */
export function eventInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "テストイベント",
    description: "説明",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
    options: [{ id: crypto.randomUUID(), label: "参加", color: "#0F82B1" }],
    ...overrides,
  };
}

/** イベントを作成して、その id と参加形態の id を返す */
export async function createEvent(overrides: Record<string, unknown> = {}) {
  const input = eventInput(overrides);
  const res = await api.post("/events", input);
  if (res.status !== 201) throw new Error(`イベントの作成に失敗しました: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  return { id, input, optionId: input.options[0].id };
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

/** 回答して、その id を返す */
export async function submit(eventId: string, optionId: string, overrides: Record<string, unknown> = {}) {
  const res = await api.post(`/events/${eventId}/participants`, submissionInput(optionId, overrides));
  if (res.status !== 201) throw new Error(`回答に失敗しました: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { participant: { id: string } }).participant.id;
}

/** client の index.html の、OG のメタタグの部分 */
export const indexHtml = `<!doctype html><html><head>
<meta property="og:title" content="イツヒマ" />
<meta property="og:description" content="既定の説明" />
<meta property="og:image" content="https://itsuhima.utcode.net/og-image.jpg" />
</head><body><div id="root"></div></body></html>`;

/** 静的アセットの代わり。どのパスにも index.html を返す (SPA のフォールバックと同じ) */
const assets = {
  fetch: async (_request: Request) =>
    new Response(indexHtml, { headers: { "Content-Type": "text/html", ETag: '"abc"' } }),
};

/** Worker の入口 (main.ts) にリクエストを送る。パスは `/api` を含めたものを渡す */
export function requestWorker(path: string, init: RequestInit = {}, bindings: Record<string, string> = {}) {
  return app.request(`https://itsuhima.example${path}`, init, { ...env, ASSETS: assets, ...bindings });
}
