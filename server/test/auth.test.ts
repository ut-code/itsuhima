import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { api, createEvent, login, submit } from "./helpers.js";

const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice", picture: "https://example.com/a.png" };

describe("ログイン (/api/auth)", () => {
  test("Google の認可 URL を返す。スコープは openid だけ、リダイレクト先は PUBLIC_ORIGIN の /api/auth/callback/google", async () => {
    const res = await api.post("/auth/sign-in/social", { provider: "google", callbackURL: "/home" });

    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const authorize = new URL(url);
    expect(authorize.origin).toBe("https://accounts.google.com");
    expect(authorize.searchParams.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${env.PUBLIC_ORIGIN}/api/auth/callback/google`);
    expect(authorize.searchParams.get("scope")).toBe("openid");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("ID トークンでのログインは閉じている", async () => {
    const res = await api.post("/auth/sign-in/social", { provider: "google", idToken: { token: "x.y.z" } });

    expect(res.status).not.toBe(200);
  });

  test("ログインすると、セッションからユーザーが取れる", async () => {
    const user = await login(alice);

    const res = await user.get("/auth/get-session");

    expect(res.status).toBe(200);
    const session = (await res.json()) as { user: { id: string } } | null;
    expect(session?.user.id).toEqual(expect.any(String));
  });

  test("ログインしていなければ、セッションは null", async () => {
    const res = await api.get("/auth/get-session");

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test("Google の sub のほかは保存しない (メールアドレス・名前・画像・トークン・IP・User-Agent)", async () => {
    const user = await login(alice);
    await user.get("/auth/get-session", { headers: { "User-Agent": "test-agent", "CF-Connecting-IP": "192.0.2.1" } });

    const users = await env.DB.prepare(`SELECT "email", "name", "image" FROM "user"`).all();
    expect(users.results).toEqual([{ email: "google-alice@google.invalid", name: "", image: null }]);
    const accounts = await env.DB.prepare(
      `SELECT "accountId", "providerId", "accessToken", "refreshToken", "idToken" FROM "account"`,
    ).all();
    expect(accounts.results).toEqual([
      { accountId: "google-alice", providerId: "google", accessToken: null, refreshToken: null, idToken: null },
    ]);
    const sessions = await env.DB.prepare(`SELECT "ipAddress", "userAgent" FROM "session"`).all();
    expect(sessions.results).toEqual([{ ipAddress: null, userAgent: null }]);
  });

  test("同じ Google アカウントでログインし直すと、同じユーザーになる", async () => {
    const first = await login(alice);
    const { id } = await createEvent({}, first);

    const second = await login(alice);

    const res = await second.get(`/events/${id}`);
    expect(((await res.json()) as { canEdit: boolean }).canEdit).toBe(true);
    const count = await env.DB.prepare(`SELECT count(*) AS n FROM "user"`).first("n");
    expect(count).toBe(1);
  });
});

describe("アカウントの削除", () => {
  test("消すと、作ったイベントと回答は残り、誰でも編集できる匿名のものになる", async () => {
    const user = await login(alice);
    const { id, optionId } = await createEvent({}, user);
    const participantId = await submit(id, optionId, {}, user);
    // 回答を消して、履歴に持ち主を残す
    await user.delete(`/events/${id}/participants/${participantId}`);

    const res = await user.post("/auth/delete-user", {});

    expect(res.status).toBe(200);
    expect(await env.DB.prepare(`SELECT count(*) AS n FROM "user"`).first("n")).toBe(0);
    const event = await api.get(`/events/${id}`);
    expect(((await event.json()) as { canEdit: boolean }).canEdit).toBe(true);
    const history = await env.DB.prepare(`SELECT "before", "userId" FROM "history" WHERE "eventId" = ?`)
      .bind(id)
      .first<{ before: string; userId: string | null }>();
    expect(JSON.parse(history?.before ?? "{}")).not.toHaveProperty("userId");
    expect(history?.userId).toBeNull();
    // 消した回答は、匿名の回答として誰でも戻せる
    const list = (await (await api.get(`/events/${id}/history`)).json()) as { id: string; canRestore: boolean }[];
    expect(list[0].canRestore).toBe(true);
    expect((await api.post(`/events/${id}/history/${list[0].id}/restore`)).status).toBe(204);
  });
});
