import { env } from "cloudflare:workers";
import { authTestOverrides } from "../src/auth.js";
import { app } from "../src/main.js";

/**
 * API を呼ぶクライアント。cookies を全てのリクエストに付ける。
 * パスは API の `/api` を除いたもの (`/events` など) を渡す。
 */
function apiClient(cookies: string[] = []) {
  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookies.length > 0) {
      headers.set("Cookie", cookies.join("; "));
      // Better Auth は、Cookie 付きの POST の Origin を確かめる
      headers.set("Origin", env.PUBLIC_ORIGIN);
    }
    return app.request(`/api${path}`, { ...init, headers }, env);
  };
  const send = (method: string, path: string, body?: unknown) =>
    request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    get: (path: string, init?: RequestInit) => request(path, init),
    post: (path: string, body?: unknown) => send("POST", path, body),
    put: (path: string, body?: unknown) => send("PUT", path, body),
    patch: (path: string, body?: unknown) => send("PATCH", path, body),
    delete: (path: string) => send("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

/** ログインしていない人。サーバーはブラウザを識別しないので、Cookie は付けない */
export const api = apiClient();

/** Google のアカウント。ID トークンの claim */
export type GoogleUser = { sub: string; email?: string; name?: string; picture?: string };

/**
 * Google でログインし、セッションの Cookie を付けて API を呼ぶクライアントを返す。
 * Google は呼ばず、署名なしの ID トークンを使う (テストでだけ受け付けるようにする)。
 */
export async function login(user: GoogleUser) {
  authTestOverrides.acceptAnyIdToken = true;
  try {
    const res = await api.post("/auth/sign-in/social", {
      provider: "google",
      idToken: { token: unsignedGoogleIdToken(user) },
    });
    if (res.status !== 200) throw new Error(`ログインに失敗しました: ${res.status} ${await res.text()}`);
    const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
    return Object.assign(apiClient(cookies), { cookies });
  } finally {
    authTestOverrides.acceptAnyIdToken = false;
  }
}

/** Google の ID トークンの形をした、署名なしの JWT */
function unsignedGoogleIdToken(user: GoogleUser) {
  const encode = (value: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, iat: now, exp: now + 3600, ...user };
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

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
export async function createEvent(overrides: Record<string, unknown> = {}, client: ApiClient = api) {
  const input = eventInput(overrides);
  const res = await client.post("/events", input);
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
export async function submit(
  eventId: string,
  optionId: string,
  overrides: Record<string, unknown> = {},
  client: ApiClient = api,
) {
  const res = await client.post(`/events/${eventId}/participants`, submissionInput(optionId, overrides));
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
