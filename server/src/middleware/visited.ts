import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.js";

/** 使ったことがあるか。本人は表さない (値はいつも "1") */
export const VISITED_COOKIE = "visited";

/**
 * イベントを作ったか回答したブラウザに `visited=1` の Cookie を付ける。`/` から `/home` へのリダイレクト (`routes/landing.ts`) に使う。
 * 作成と回答の経路にだけ付ける (ページを開くだけで呼ぶ API に付けると、LP を見ただけでリダイレクトされるようになる)。
 */
export const visitedMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (c.res.ok && getCookie(c, VISITED_COOKIE) === undefined) {
    setCookie(c, VISITED_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      secure: c.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
});
