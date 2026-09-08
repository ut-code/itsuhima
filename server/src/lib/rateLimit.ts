/**
 * トークン単位のインメモリなレートリミッタ。
 *
 * LLM は人間の 10 倍の頻度で叩くため MCP 経由には必須。fly.io では単一マシン運用の
 * 想定なのでプロセス内で完結させる。複数マシンに増やす際は Redis 等に移すこと。
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
/** メモリリーク防止のため、追跡するキー数の上限 */
const MAX_TRACKED_KEYS = 10_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function consumeRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
