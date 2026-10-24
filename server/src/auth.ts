import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "./db/index.js";
import * as schema from "./db/schema.js";
import type { Bindings } from "./env.js";
import { linkBrowserToUser } from "./services/link.js";

/**
 * テストだけで差し替える設定。Google を呼ばずに、署名なしの ID トークンでログインできるようにする。
 * 本番のコードからは触らない (触ると、誰でも任意のユーザーになりすませる)。
 */
export const authTestOverrides: { acceptAnyIdToken?: boolean } = {};

/**
 * Better Auth (Google ログイン) のインスタンス。
 * Workers では env (D1・シークレット) がリクエストの中でしか取れないので、リクエストごとに作る。
 * セッションを見る必要がないリクエスト (Cookie が無いなど) では作らない。
 * @param browserId ログインしたときに、このブラウザの参加者をユーザーに紐づける (検証済みの browserId を渡す)
 */
export function createAuth(env: Bindings, db: Db, { browserId }: { browserId?: string } = {}) {
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
        // プロフィールを編集する画面がないので、名前と画像はログインのたびに Google の値で上書きする
        overrideUserInfoOnSignIn: true,
        ...(acceptAnyIdToken ? { verifyIdToken: async () => true } : {}),
      },
    },
    user: {
      // ユーザーを消しても、作ったイベントと回答は残る (participant.userId が null になり、誰も操作できなくなる)。
      // パスワードがないので、ログインして 1 日 (freshAge の既定) 以内のセッションでだけ消せる
      deleteUser: { enabled: true },
    },
    session: {
      // ログインは任意なので長めに持つ。延長の書き込み (D1) は 7 日に 1 回まで
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24 * 7,
      // 10 分は、署名付きの Cookie だけでセッションを確かめ、DB を読まない
      cookieCache: { enabled: true, maxAge: 60 * 10 },
    },
    databaseHooks: {
      session: {
        create: {
          // ログインの方法によらず、セッションができたら 1 回だけ走る
          after: async (session) => {
            if (!browserId) return;
            try {
              const { conflictEventIds } = await linkBrowserToUser(db, { browserId, userId: session.userId });
              if (conflictEventIds.length > 0) {
                console.warn("同じイベントにすでにユーザーの参加者があるため、紐づけなかった", conflictEventIds);
              }
            } catch (e) {
              // 紐づけに失敗しても、ログインは通す
              console.error("ブラウザの参加者をユーザーに紐づけられませんでした", e);
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
