import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { parse, serialize } from "hono/utils/cookie";
import type { Bindings } from "../env.js";

/**
 * ログインした Google アカウントのメールアドレスを入れる Cookie。
 * どのアカウントでログインしているかを本人に示すためだけに使う。DB には保存しない。
 * 名前から中身がわからないようにする。中身はユーザーの id と一緒に暗号化し (JS から読めない HttpOnly)、別のユーザーのセッションでは使わない。
 */
export const ACCOUNT_EMAIL_COOKIE = "itsuhima.hint";

/** セッションの期限 (`auth.ts` の session.expiresIn) と同じ */
export const ACCOUNT_EMAIL_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(env: Bindings) {
  return { path: "/", httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "Lax" } as const;
}

/** メールアドレスを入れる Set-Cookie の値 */
export async function accountEmailCookie(env: Bindings, account: { userId: string; email: string }) {
  const value = await symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data: JSON.stringify(account) });
  return serialize(ACCOUNT_EMAIL_COOKIE, value, { ...cookieOptions(env), maxAge: ACCOUNT_EMAIL_MAX_AGE });
}

/** メールアドレスの Cookie を消す Set-Cookie の値 (ログアウトとアカウントの削除) */
export function clearAccountEmailCookie(env: Bindings) {
  return serialize(ACCOUNT_EMAIL_COOKIE, "", { ...cookieOptions(env), maxAge: 0 });
}

/**
 * Cookie のメールアドレス。無いか、読めないか、別のユーザーのものなら null
 * @param cookieHeader リクエストの Cookie ヘッダ
 */
export async function readAccountEmail(env: Bindings, cookieHeader: string | undefined, userId: string) {
  const value = cookieHeader ? parse(cookieHeader, ACCOUNT_EMAIL_COOKIE)[ACCOUNT_EMAIL_COOKIE] : undefined;
  if (!value) return null;
  try {
    const account = JSON.parse(await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: value })) as {
      userId?: unknown;
      email?: unknown;
    };
    return account.userId === userId && typeof account.email === "string" ? account.email : null;
  } catch {
    return null;
  }
}
