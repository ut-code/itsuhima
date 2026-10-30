import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";
import { VISITED_COOKIE } from "../middleware/visited.js";

/**
 * サービスを利用したことのあるユーザは、LP ("/") からホーム ("/home") にリダイレクトする。
 */
export function landing(c: Context<AppEnv>) {
  if (getCookie(c, VISITED_COOKIE) !== undefined) {
    return c.redirect("/home", 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
}
