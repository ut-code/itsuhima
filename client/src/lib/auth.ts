import { createAuthClient } from "better-auth/react";

/** Better Auth のクライアント。API と同じオリジンの /api/auth を呼ぶ */
export const authClient = createAuthClient({ basePath: "/api/auth" });

/** Google から戻ってきたのが、このタブで始めたログインかの印。sessionStorage はリダイレクトをまたいでもタブに残る */
const JUST_LOGGED_IN_KEY = "itsuhima:justLoggedIn";

/** Google でログインする。終わると今のページに戻る */
export function signInWithGoogle() {
  try {
    sessionStorage.setItem(JUST_LOGGED_IN_KEY, "1");
  } catch (_) {
    // 使えなくてもログインはできる (ログイン後の知らせが出ないだけ)
  }
  return authClient.signIn.social({ provider: "google", callbackURL: window.location.pathname });
}

/** ログインして戻ってきた直後なら true を返し、印を消す (1 回だけ true になる) */
export function consumeJustLoggedIn() {
  try {
    const value = sessionStorage.getItem(JUST_LOGGED_IN_KEY);
    sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
    return value === "1";
  } catch (_) {
    return false;
  }
}
