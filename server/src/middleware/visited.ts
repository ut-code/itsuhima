import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.js";

/** 使ったことがあるか。本人は表さない (値はいつも "1") */
export const VISITED_COOKIE = "visited";

/**
 * API を使ったブラウザに `visited=1` の Cookie を付ける。`/` から `/home` へのリダイレクト (`routes/landing.ts`) に使う。
 */
export const visitedMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (getCookie(c, VISITED_COOKIE) === undefined) {
    setCookie(c, VISITED_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      secure: c.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
});

/** ゲストがこのブラウザの記録を削除したとき。`/` を開いても、`/home` にリダイレクトしないようにする */
export function deleteVisited(c: Context<AppEnv>) {
  deleteCookie(c, VISITED_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: c.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return c.body(null, 204);
}
