import type { Context, MiddlewareHandler } from "hono";
import { getCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../main.js";

const COOKIE_NAME = "browserId";

/**
 * 署名鍵のローテーションに対応するため、現行の鍵、前の鍵の順に検証する。
 * @returns 検証できた browserId。Cookie が無ければ undefined。Cookie はあるがどの鍵でも検証できなければ false
 */
async function readBrowserId(c: Context, secrets: string[]) {
  if (getCookie(c, COOKIE_NAME) === undefined) { 
    return undefined;
  }

  for (const secret of secrets) {
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (value) { 
      return value;
    }
  }
  return false;
}

export const browserIdMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
    console.error("COOKIE_SECRET is not set");
    return c.json({ message: "サーバー設定エラー" }, 500);
  }
  const previousSecrets = (process.env.COOKIE_SECRET_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const browserId = await readBrowserId(c, [cookieSecret, ...previousSecrets]);

  // Cookie はあるがどの鍵でも検証できなかった
  if (browserId === false) {
    console.warn("browserId Cookie の署名を検証できませんでした");
    return c.json({ message: "ブラウザのCookie設定に問題があります。" }, 400);
  }

  // 初回アクセスでの新規発行
  if (browserId === undefined) {
    const newBrowserId = crypto.randomUUID();
    await setSignedCookie(c, COOKIE_NAME, newBrowserId, cookieSecret, cookieOptions);
    c.set("browserId", newBrowserId);
    return next();
  }

  // 2回目以降のアクセスでの再発行 (新しい鍵で署名・有効期限の更新)
  await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  c.set("browserId", browserId);
  return next();
};
