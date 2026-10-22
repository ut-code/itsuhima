import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../main.js";

const COOKIE_NAME = "browserId";

/**
 * 署名付き Cookie から browserId を復元する。無ければ新規発行し、有効期限を延ばすため毎回再発行する。
 *
 * 署名鍵のローテーションに対応するため、現行の `COOKIE_SECRET` で検証できなければ
 * `COOKIE_SECRET_PREVIOUS`(カンマ区切り)の鍵を順に試す。再発行は常に現行の鍵で行うので、
 * アクセスのあった利用者から順に新しい鍵へ移行する。
 */
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

  let browserId: string | undefined;
  let hasInvalidCookie = false;
  for (const secret of [cookieSecret, ...previousSecrets]) {
    // 値があれば文字列、Cookie が無ければ undefined、署名が不正なら false
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (value) {
      browserId = value;
      break;
    }
    if (value === false) hasInvalidCookie = true;
  }

  if (!browserId) {
    // 鍵の差し替え時に COOKIE_SECRET_PREVIOUS を設定し忘れると全員がここに来る。気づけるよう警告を残す
    if (hasInvalidCookie) console.warn("browserId Cookie の署名を検証できませんでした。新しい browserId を発行します");
    browserId = crypto.randomUUID();
  }

  await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  c.set("browserId", browserId);
  return next();
};
