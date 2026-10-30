import type { Context } from "hono";
import { getCookie, getSignedCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";

/**
 * 前の、ブラウザごとの識別子 (browserId) の Cookie。今は発行しない。
 * 前の一覧を交換する口 (`routes/legacy.ts`) だけが読む。
 */
const COOKIE_NAME = "browserId";

/**
 * browserId の Cookie を読む。署名鍵のローテーションに対応するため、現行の鍵、前の鍵の順に検証する。
 * @returns 検証できた browserId。Cookie が無いか、どの鍵でも検証できなければ null
 */
export async function readLegacyBrowserId(c: Context<AppEnv>): Promise<string | null> {
  if (getCookie(c, COOKIE_NAME) === undefined) {
    return null;
  }

  const cookieSecret = c.env.COOKIE_SECRET;
  if (!cookieSecret) {
    throw new Error("COOKIE_SECRET is not set");
  }
  const previousSecrets = (c.env.COOKIE_SECRET_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const secret of [cookieSecret, ...previousSecrets]) {
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (value) {
      return value;
    }
  }
  console.warn("browserId Cookie の署名を検証できませんでした");
  return null;
}
