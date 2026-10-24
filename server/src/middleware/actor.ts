import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";

/** Better Auth のセッションの Cookie の名前。https では `__Secure-` が前に付く */
const SESSION_COOKIE_SUFFIX = "better-auth.session_token";

/**
 * 操作する本人 (`actor`) を決める。browserIdMiddleware と db のミドルウェアの後に置く。
 * ログインしていれば (セッションの Cookie があれば) userId も入れる。
 * セッションの Cookie が無ければ Better Auth を作らないので、ログインしていない利用者のコストは増えない。
 */
export const actorMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const hasSession = Object.keys(getCookie(c)).some((name) => name.endsWith(SESSION_COOKIE_SUFFIX));
  let session = null;
  if (hasSession) {
    // Better Auth は大きいので、使うときだけ読み込む
    const { createAuth } = await import("../auth.js");
    session = await createAuth(c.env, c.get("db")).api.getSession({ headers: c.req.raw.headers });
  }

  c.set("actor", { browserId: c.get("browserId"), userId: session?.user.id ?? null });
  await next();
};
