import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "./db/index.js";
import * as schema from "./db/schema.js";
import type { Bindings } from "./env.js";

/**
 * テストだけで差し替える設定。Google を呼ばずに、署名なしの ID トークンでログインできるようにする。
 * 本番のコードからは触らない (触ると、誰でも任意のユーザーになりすませる)。
 */
export const authTestOverrides: { acceptAnyIdToken?: boolean } = {};

/**
 * Better Auth (Google ログイン) のインスタンス。
 * Workers では env (D1・シークレット) がリクエストの中でしか取れないので、リクエストごとに作る。
 * セッションを見る必要がないリクエスト (Cookie が無いなど) では作らない。
 */
export function createAuth(env: Bindings, db: Db) {
  const acceptAnyIdToken = authTestOverrides.acceptAnyIdToken === true;

  return betterAuth({
    baseURL: env.PUBLIC_ORIGIN,
    // Google のリダイレクト URI (<PUBLIC_ORIGIN>/api/auth/callback/google) がこれで決まる。変えない
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    // D1 は対話的なトランザクションに対応していないので、transaction は既定の false のまま (付けない)
    database: drizzleAdapter(db, { provider: "sqlite", schema, camelCase: true }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // スコープは既定 (openid email profile) のまま。ID トークンでのログインは使わないので閉じる
        disableIdTokenSignIn: !acceptAnyIdToken,
        ...(acceptAnyIdToken ? { verifyIdToken: async () => true } : {}),
      },
    },
    session: {
      // ログインは任意なので長めに持つ。延長の書き込み (D1) は 7 日に 1 回まで
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24 * 7,
      // 10 分は、署名付きの Cookie だけでセッションを確かめ、DB を読まない
      cookieCache: { enabled: true, maxAge: 60 * 10 },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
