import type { Context } from "hono";
import { getCookie, getSignedCookie } from "hono/cookie";
import { serialize } from "hono/utils/cookie";
import type { AppEnv, Bindings } from "../env.js";

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

/**
 * browserId の Cookie を消す Set-Cookie の値。main は `Domain=<ホスト名>` 付きで発行し、#123 からは host-only で発行したので、
 * ブラウザには 2 つありうる。名前・Domain・Path が同じものしか消せないので、両方に送る。
 */
export function clearLegacyBrowserIdCookies(env: Bindings) {
  const options = {
    path: "/",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 0,
  } as const;
  return [
    serialize(COOKIE_NAME, "", options),
    serialize(COOKIE_NAME, "", { ...options, domain: new URL(env.PUBLIC_ORIGIN).hostname }),
  ];
}
