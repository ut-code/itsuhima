import { createAuthClient } from "better-auth/react";

/** Better Auth のクライアント。API と同じオリジンの /api/auth を呼ぶ */
export const authClient = createAuthClient({ basePath: "/api/auth" });

/**
 * Google でログインする。終わると callbackURL (既定は今のページ) に戻る。
 * Google のページに移るので、入力中の内容は消える。
 */
export function signInWithGoogle(callbackURL = window.location.pathname + window.location.search) {
  return authClient.signIn.social({ provider: "google", callbackURL });
}
