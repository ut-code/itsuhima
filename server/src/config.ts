import type { CookieOptions } from "hono/utils/cookie";
import type { Bindings } from "./env.js";

export function cookieOptions(env: Bindings) {
  return {
    path: "/",
    domain: env.DOMAIN || "localhost", // /home へのリダイレクトのためフロントエンドにも送る
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // Express だとミリ秒だったが、Hono では秒らしい
  } as const satisfies CookieOptions;
}
