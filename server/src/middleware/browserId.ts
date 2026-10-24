import type { Context, MiddlewareHandler } from "hono";
import { getCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../config.js";
import type { AppEnv } from "../env.js";

const COOKIE_NAME = "browserId";

/**
 * 署名鍵のローテーションに対応するため、現行の鍵、前の鍵の順に検証する。
 * @returns 検証できた browserId。Cookie が無いか、どの鍵でも検証できなければ undefined
 */
async function readBrowserId(c: Context<AppEnv>, secrets: string[]) {
  if (getCookie(c, COOKIE_NAME) === undefined) {
    return undefined;
  }

  for (const secret of secrets) {
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (value) {
      return value;
    }
  }
  // 鍵を外した後の古い Cookie など。作り直せば使い続けられるので、エラーにはしない
  console.warn("browserId Cookie の署名を検証できなかったので、新しく発行します");
  return undefined;
}

export const browserIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookieSecret = c.env.COOKIE_SECRET;
  if (!cookieSecret) {
    console.error("COOKIE_SECRET is not set");
    return c.json({ message: "サーバー設定エラー" }, 500);
  }
  const previousSecrets = (c.env.COOKIE_SECRET_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const browserId = await readBrowserId(c, [cookieSecret, ...previousSecrets]);

  // 初回アクセス (または検証できなかった) での新規発行
  if (browserId === undefined) {
    const newBrowserId = crypto.randomUUID();
    await setSignedCookie(c, COOKIE_NAME, newBrowserId, cookieSecret, cookieOptions(c.env));
    c.set("browserId", newBrowserId);
    return next();
  }

  // 2回目以降のアクセスでの再発行 (新しい鍵で署名・有効期限の更新)
  await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions(c.env));
  c.set("browserId", browserId);
  return next();
};
