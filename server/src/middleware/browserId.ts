import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../main.js";

const COOKIE_NAME = "browserId";

/**
 * 署名鍵のローテーションに対応するため、現行の鍵、前の鍵の順に検証する。
 * @returns 検証できた browserId / Cookie が無ければ undefined / どの鍵でも検証できなければ false
 */
async function readBrowserId(c: Context, secrets: string[]) {
  for (const secret of secrets) {
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (value) return value;
    if (value === undefined) return undefined;
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

  // 異常: 鍵の差し替え時に COOKIE_SECRET_PREVIOUS を設定し忘れると全員がここに来るので、ログも残す
  if (browserId === false) {
    console.warn("browserId Cookie の署名を検証できませんでした");
    return c.json({ message: "ブラウザのCookie設定に問題があります。" }, 400);
  }

  // 初回アクセス: 新規発行
  if (browserId === undefined) {
    const newBrowserId = crypto.randomUUID();
    await setSignedCookie(c, COOKIE_NAME, newBrowserId, cookieSecret, cookieOptions);
    c.set("browserId", newBrowserId);
    return next();
  }

  // 2回目以降: 有効期限を延ばすため再発行する。前の鍵で署名されていた場合も、ここで現行の鍵に移る
  await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  c.set("browserId", browserId);
  return next();
};
