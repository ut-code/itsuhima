import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { createBrowser } from "./helpers.js";

const alice = { sub: "google-alice", email: "alice@example.com", name: "Alice" };

describe("ログイン (/api/auth)", () => {
  test("Google の認可 URL を返す。スコープは openid email profile、リダイレクト先は PUBLIC_ORIGIN の /api/auth/callback/google", async () => {
    const browser = createBrowser();

    const res = await browser.post("/auth/sign-in/social", { provider: "google", callbackURL: "/home" });

    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const authorize = new URL(url);
    expect(authorize.origin).toBe("https://accounts.google.com");
    expect(authorize.searchParams.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${env.PUBLIC_ORIGIN}/api/auth/callback/google`);
    expect(authorize.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("ID トークンでのログインは閉じている", async () => {
    const browser = createBrowser();

    const res = await browser.post("/auth/sign-in/social", { provider: "google", idToken: { token: "x.y.z" } });

    expect(res.status).not.toBe(200);
  });

  test("ログインすると、セッションからユーザーが取れる", async () => {
    const browser = createBrowser();
    await browser.login(alice);

    const res = await browser.get("/auth/get-session");

    expect(res.status).toBe(200);
    const session = (await res.json()) as { user: { email: string; name: string } };
    expect(session.user).toMatchObject({ email: "alice@example.com", name: "Alice" });
  });

  test("ログインしていなければ、セッションは null", async () => {
    const res = await createBrowser().get("/auth/get-session");

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
