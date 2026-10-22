import type { D1Database } from "@cloudflare/workers-types";
import type { Db } from "./db/index.js";
import type { Actor } from "./services/actor.js";

/** Worker のバインディングと環境変数。値は `wrangler.toml` の vars と、`wrangler secret put` で入れる。 */
export type Bindings = {
  DB: D1Database;
  /** client のビルド結果 (静的アセット)。`run_worker_first` に当たったリクエストから、SPA の HTML などを取り出すのに使う */
  ASSETS: { fetch(request: Request): Promise<Response> };
  COOKIE_SECRET: string;
  /** 署名鍵のローテーション中だけ、前の鍵をカンマ区切りで入れる */
  COOKIE_SECRET_PREVIOUS?: string;
  /** browserId Cookie の Domain */
  DOMAIN?: string;
  /** "production" のとき Cookie に Secure を付ける */
  NODE_ENV?: string;
  /** ブラウザから見えるオリジン (例: https://itsuhima.utcode.net)。Better Auth の baseURL。OAuth のリダイレクト URI もここから作る */
  PUBLIC_ORIGIN: string;
  /** Better Auth の署名・暗号化の鍵 (32 文字以上のランダム値) */
  BETTER_AUTH_SECRET: string;
  /** Google の OAuth クライアント */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type AppVariables = {
  browserId: string;
  db: Db;
  /** 操作する本人 (actorMiddleware が入れる) */
  actor: Actor;
};

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
