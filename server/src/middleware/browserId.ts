import crypto from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieOptions } from "../main.js";

const COOKIE_NAME = "browserId";

/**
 * Express の署名付きクッキー（s:value.signature 形式）を検証して値を取り出す
 */
function unsignExpressCookie(signedValue: string, secret: string): string | null {
  if (!signedValue.startsWith("s:")) return null;

  const raw = signedValue.slice(2); // `s:` を削除
  const lastDotIndex = raw.lastIndexOf(".");
  if (lastDotIndex === -1) return null;

  const value = raw.slice(0, lastDotIndex); // 署名前の値（uuid）
  const signature = raw.slice(lastDotIndex + 1);

  // Express と同じアルゴリズムで署名を検証
  const expectedSignature = crypto.createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, "");

  if (signature === expectedSignature) {
    return value;
  }

  return null;
}

/**
 * Express → Hono の移行で signed cookie 形式が変わったため両方に対応するミドルウェア
 */
export const browserIdMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
    console.error("COOKIE_SECRET is not set");
    return c.json({ message: "サーバー設定エラー" }, 500);
  }

  let browserId: string | undefined;
  let needsReissue = false;

  // 新形式 （Hono） を試す
  browserId = (await getSignedCookie(c, cookieSecret, COOKIE_NAME)) || undefined;

  if (!browserId) {
    const rawCookie = getCookie(c, COOKIE_NAME);

    if (rawCookie?.startsWith("s:")) {
      const legacy = unsignExpressCookie(rawCookie, cookieSecret);
      if (legacy) {
        browserId = legacy;
        needsReissue = true;
      }
    }
  }

  if (browserId && needsReissue) {
    await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  }

  if (!browserId) {
    browserId = crypto.randomUUID();
    await setSignedCookie(c, COOKIE_NAME, browserId, cookieSecret, cookieOptions);
  }

  // コンテキストに保存（後続のハンドラで c.get('browserId') で取得可能）
  c.set("browserId", browserId);

  await next();
};
