import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";
import { hasSessionCookie } from "../middleware/actor.js";
import { VISITED_COOKIE } from "../middleware/visited.js";

/**
 * サービスを利用したことのあるユーザは、LP ("/") からホーム ("/home") にリダイレクトする。
 * ログインしていればセッションの Cookie で、ゲストなら書き込んだことがあるか (`visited`) で決める。
 * セッションが有効かは確かめない (Better Auth を作らずに済ませる。切れていても、ホームはゲストとして開ける)。
 */
export function landing(c: Context<AppEnv>) {
  if (hasSessionCookie(c) || getCookie(c, VISITED_COOKIE) !== undefined) {
    return c.redirect("/home", 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
}
