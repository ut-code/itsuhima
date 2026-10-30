import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.js";

/** 読むだけのメソッド。制限しない */
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * 書き込み (作成・変更・削除・戻す、ログイン) を制限する。回数と期間は wrangler.toml の `[[ratelimits]]`。
 * 認証のない書き込みを、誰でも大量に送れないようにするため。
 * ログインした人はユーザーごと (大学などで、同じ IP の人が多いため)、していない人は IP ごとに数える。actorMiddleware の後に置く。
 * IP (`CF-Connecting-IP`) が無いとき (ローカルとテスト) は制限しない。
 */
export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP");
  if (SAFE_METHODS.includes(c.req.method) || ip === undefined) {
    return next();
  }
  const { userId } = c.get("actor");
  const { success } = await c.env.WRITE_RATE_LIMITER.limit({ key: userId === null ? `ip:${ip}` : `user:${userId}` });
  if (!success) {
    return c.json({ message: "操作が多すぎます。しばらく待ってからやり直してください。" }, 429);
  }
  return next();
});
