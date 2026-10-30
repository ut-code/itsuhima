import type { Context } from "hono";
import type { AppEnv } from "../env.js";
import { accountEmailCookie, clearAccountEmailCookie } from "../lib/accountEmail.js";
import { clearVisitedCookie } from "../middleware/visited.js";

/** ログイン中のメールアドレスと `visited` の Cookie を消すパス (ログアウトとアカウントの削除) */
const SIGN_OUT_PATHS = ["/api/auth/sign-out", "/api/auth/delete-user"];

/**
 * Better Auth (Google ログインと、MCP クライアント向けの OAuth の認可サーバー)。`/api/auth/*` を受け持つ。
 * ログインしたら、Google アカウントのメールアドレスを暗号化した Cookie に入れる (DB には保存しない)。
 */
export async function authHandler(c: Context<AppEnv>) {
  // Better Auth は大きいので、使うときだけ読み込む
  const { createAuth } = await import("../auth.js");
  let signedIn: { userId: string; email: string } | null = null;
  const auth = createAuth(c.env, c.get("db"), {
    onSignIn: (account) => {
      signedIn = account;
    },
  });
  const res = await auth.handler(c.req.raw);

  const setCookies = signedIn
    ? [await accountEmailCookie(c.env, signedIn)]
    : SIGN_OUT_PATHS.includes(c.req.path) && res.ok
      ? [clearAccountEmailCookie(c.env), clearVisitedCookie(c.env)]
      : [];
  if (setCookies.length === 0) return res;
  const headers = new Headers(res.headers);
  for (const value of setCookies) headers.append("Set-Cookie", value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
