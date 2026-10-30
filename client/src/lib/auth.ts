import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";
import { useEffect, useState } from "react";
import type { AppType } from "../../../server/src/routes/api";
import { API_ENDPOINT } from "../utils";

/** Better Auth のクライアント。API と同じオリジンの /api/auth を呼ぶ */
export const authClient = createAuthClient({ basePath: "/api/auth" });

/**
 * Google でログインする。終わると callbackURL (既定は今のページ) に戻る。
 * Google のページに移るので、入力中の内容は消える。
 */
export function signInWithGoogle(callbackURL = window.location.pathname + window.location.search) {
  return authClient.signIn.social({ provider: "google", callbackURL });
}

const client = hc<AppType>(API_ENDPOINT);

/**
 * ログイン中の Google アカウントのメールアドレス。DB には保存せず、このブラウザでログインしたときに
 * サーバーが暗号化した Cookie に入れたものを返す。読み込み中は undefined、分からなければ null
 */
export function useAccountEmail(loggedIn: boolean) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!loggedIn) {
      setEmail(null);
      return;
    }
    let cancelled = false;
    client.me
      .$get()
      .then(async (res) => (res.status === 200 ? (await res.json()).email : null))
      .catch(() => null)
      .then((value) => {
        if (!cancelled) setEmail(value);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);
  return email;
}

/** 「〇〇 でログイン中」の文 */
export function loggedInLabel(email: string | null | undefined) {
  return email ? `${email} でログイン中` : "Google でログイン中";
}
