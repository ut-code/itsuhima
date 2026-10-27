import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";

/**
 * サービスを利用したことのあるユーザは、LP ("/") からホーム ("/home") にリダイレクトする。
 * TODO: Google ログインのユーザへの対応の確認
 */
export function landing(c: Context<AppEnv>) {
  if (getCookie(c, "browserId") !== undefined) {
    return c.redirect("/home", 302);
  }
  return c.env.ASSETS.fetch(c.req.raw);
}
