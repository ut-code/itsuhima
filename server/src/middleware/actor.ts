import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.js";
import { anonymousActor } from "../services/permissions.js";

/** Better Auth のセッションの Cookie の名前。https では `__Secure-` が前に付く */
const SESSION_COOKIE_SUFFIX = "better-auth.session_token";

/**
 * 操作する本人 (`actor`) を決める。db のミドルウェアの後に置く。
 * ログインしていれば (セッションの Cookie があり、有効なら) userId を入れる。
 * セッションの Cookie が無ければ Better Auth を作らないので、ログインしていない利用者のコストは増えない。
 */
export const actorMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const hasSession = Object.keys(getCookie(c)).some((name) => name.endsWith(SESSION_COOKIE_SUFFIX));
  if (!hasSession) {
    c.set("actor", anonymousActor);
    return next();
  }
  // Better Auth は大きいので、使うときだけ読み込む
  const { createAuth } = await import("../auth.js");
  const session = await createAuth(c.env, c.get("db")).api.getSession({ headers: c.req.raw.headers });
  c.set("actor", { userId: session?.user.id ?? null });
  return next();
});
