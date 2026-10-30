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
  /** 前の browserId の Cookie の署名鍵。前の一覧を交換する口 (`routes/legacy.ts`) で、Cookie を検証するのに使う */
  COOKIE_SECRET: string;
  /** 署名鍵のローテーション中だけ、前の鍵をカンマ区切りで入れる */
  COOKIE_SECRET_PREVIOUS?: string;
  /** "true" のとき、Worker が返す全てのレスポンスを検索に載せない (ステージング用) */
  NOINDEX?: string;
  /** "production" のとき Cookie に Secure を付ける */
  NODE_ENV?: string;
  /**
   * ブラウザから見えるオリジン (例: https://itsuhima.utcode.net)。Better Auth の baseURL と、OAuth の issuer・MCP の resource。
   * Google のリダイレクト URI (<PUBLIC_ORIGIN>/api/auth/callback/google) もここから作るので、リクエストの Host からは決めない
   */
  PUBLIC_ORIGIN: string;
  /** Better Auth の署名・暗号化の鍵 (32 文字以上のランダム値)。ログイン中のメールアドレスの Cookie の暗号化にも使う */
  BETTER_AUTH_SECRET: string;
  /** Google の sub を HMAC にする鍵 (32 文字以上のランダム値)。替えたりなくしたりすると、全員が別のユーザーになる */
  ACCOUNT_ID_SECRET: string;
  /** Google の OAuth クライアント (ログイン) */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type AppVariables = {
  actor: Actor;
  db: Db;
};

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
