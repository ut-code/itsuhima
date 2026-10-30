import type { Context } from "hono";
import type { AppEnv } from "../env.js";
import { hasSessionCookie } from "../middleware/actor.js";

/**
 * ログインしていれば (セッションの Cookie があれば)、LP ("/") からホーム ("/home") にリダイレクトする。
 * セッションが有効かは確かめない (Better Auth を作らずに済ませる。切れていれば、ホームはゲストとして開き、Better Auth が Cookie を消す)。
 * ゲストは、client が控え (localStorage) を見て決める (`client/src/pages/Landing.tsx`)。
 */
export function landing(c: Context<AppEnv>) {
  if (hasSessionCookie(c)) {
    return c.redirect("/home", 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
}
