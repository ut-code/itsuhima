import type { D1Database, RateLimit } from "@cloudflare/workers-types";
import type { Db } from "./db/index.js";
import type { Actor } from "./services/permissions.js";

/** Worker のバインディングと環境変数。値は `wrangler.toml` の vars と、`wrangler secret put` で入れる。 */
export type Bindings = {
  DB: D1Database;
  /** client のビルド結果 (静的アセット)。`run_worker_first` に当たったリクエストから、SPA の HTML などを取り出すのに使う */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** 書き込みの、IP ごとのレート制限 (`middleware/rateLimit.ts`) */
  WRITE_RATE_LIMITER: RateLimit;
  COOKIE_SECRET: string;
  /** 署名鍵のローテーション中だけ、前の鍵をカンマ区切りで入れる */
  COOKIE_SECRET_PREVIOUS?: string;
  /** "true" のとき、Worker が返す全てのレスポンスを検索に載せない (ステージング用) */
  NOINDEX?: string;
  /** "production" のとき Cookie に Secure を付ける */
  NODE_ENV?: string;
};

export type AppVariables = {
  browserId: string;
  actor: Actor;
  db: Db;
};

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
