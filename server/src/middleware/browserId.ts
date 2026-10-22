import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../main.js";

const COOKIE_NAME = "browserId";

/**
 * 署名付き Cookie から browserId を復元する。無ければ新規発行し、有効期限を延ばすため毎回再発行する。
 */
export const browserIdMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
    console.error("COOKIE_SECRET is not set");
    return c.json({ message: "サーバー設定エラー" }, 500);
  }

  // 署名が不正な Cookie は false になるので、新規発行して置き換える
  const browserId = (await getSignedCookie(c, cookieSecret, COOKIE_NAME)) || crypto.randomUUID();
  await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  c.set("browserId", browserId);
  return next();
};
