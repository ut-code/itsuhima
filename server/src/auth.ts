import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sql } from "drizzle-orm";
import { authPlugins } from "./authPlugins.js";
import type { Db } from "./db/index.js";
import * as schema from "./db/schema.js";
import type { Bindings } from "./env.js";

/**
 * テストだけで差し替える設定。Google を呼ばずに、署名なしの ID トークンでログインできるようにする。
 * 本番のコードからは触らない (触ると、誰でも任意のユーザーになりすませる)。
 */
export const authTestOverrides: { acceptAnyIdToken?: boolean } = {};

/** Google から受け取って保存しないもの。Google の API はログインのあと使わない */
const discardedTokens = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
};

/**
 * Better Auth (Google ログインと、MCP 向けの OAuth 認可サーバー) のインスタンス。
 * Workers では env (D1・シークレット) がリクエストの中でしか取れないので、リクエストごとに作る。
 * 大きいので、使うときだけ動的に import する (セッションの Cookie が無いリクエストでは作らない)。
 *
 * 個人情報を最小にするため、DB に残すのは Google の `sub` (`account.accountId`) だけにする。
 * メールアドレス・名前・画像・Google のトークン・IP・User-Agent は保存しない。
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
        // openid だけにする。ID トークンにも、メールアドレスと名前が入らない
        disableDefaultScope: true,
        scope: ["openid"],
        // user.email は NOT NULL で、Better Auth はメールアドレスが無いとログインを止めるので、ダミーを入れる
        mapProfileToUser: (profile) => ({ email: `${profile.sub}@google.invalid`, name: "", image: undefined }),
        // ID トークンでのログインは使わないので閉じる
        disableIdTokenSignIn: !acceptAnyIdToken,
        ...(acceptAnyIdToken ? { verifyIdToken: async () => true } : {}),
      },
    },
    user: {
      // ユーザーを消しても、作ったイベントと回答は残り、匿名のもの (誰でも編集できる) になる (外部キーは ON DELETE SET NULL)。
      // パスワードがないので、ログインして 1 日 (freshAge の既定) 以内のセッションでだけ消せる
      deleteUser: {
        enabled: true,
        // 履歴に残した回答の持ち主も消す (消した回答を戻すと、匿名の回答になる)。ほかの列は外部キーで null になる
        beforeDelete: async (user) => {
          await db
            .update(schema.history)
            .set({ before: sql`json_remove(${schema.history.before}, '$.userId')` })
            .where(sql`json_extract(${schema.history.before}, '$.userId') = ${user.id}`);
        },
      },
    },
    plugins: authPlugins(env.PUBLIC_ORIGIN),
    // jwt プラグインの /token は、OAuth の /oauth2/token と紛らわしく、使わないので閉じる
    disabledPaths: ["/token"],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // 延長の書き込み (D1) は 1 日に 1 回まで
      updateAge: 60 * 60 * 24,
      // セッションは毎回 DB で確かめる (cookieCache は使わない)。Cookie にキャッシュすると、アカウントやセッションを消しても、
      // ほかの端末では有効期限まで古いセッションが使われる
    },
    advanced: {
      // セッションに IP を保存しない
      ipAddress: { disableIpTracking: true },
    },
    // 書き込みは、API 全体のレート制限 (middleware/rateLimit.ts、IP ごと) で制限する。
    // Better Auth のものは IP を見ない設定 (disableIpTracking) では全員で 1 つの枠になり、isolate ごとのメモリにしか残らない
    rateLimit: { enabled: false },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
      account: {
        create: {
          before: async (account) => ({ data: { ...account, ...discardedTokens } }),
        },
        update: {
          before: async (account) => ({ data: { ...account, ...discardedTokens } }),
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
