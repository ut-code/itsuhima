import type { D1Database } from "@cloudflare/workers-types";
import type { Db } from "./db/index.js";

/** Worker のバインディングと環境変数。値は `wrangler.toml` の vars と、`wrangler secret put` で入れる。 */
export type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
  /** 署名鍵のローテーション中だけ、前の鍵をカンマ区切りで入れる */
  COOKIE_SECRET_PREVIOUS?: string;
  /** browserId Cookie の Domain */
  DOMAIN?: string;
  /** "production" のとき Cookie に Secure を付ける */
  NODE_ENV?: string;
};

export type AppVariables = {
  browserId: string;
  db: Db;
};

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
