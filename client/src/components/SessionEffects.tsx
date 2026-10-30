import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { authClient, SIGN_IN_FAILED_PARAM } from "../lib/auth";
import { ensureLegacyExchanged } from "../lib/legacyExchange";
import { clearMyEvents } from "../lib/myEvents";

/**
 * Google ログインを中断した・失敗したときに、元のページに付いて戻ってくるクエリを読んで消す。
 * Better Auth は errorCallbackURL に `error` (中断なら `access_denied`) と `error_description` を足す。
 * ページの描画より前に消すため、読み込んだときに 1 回だけ読む。
 */
function takeSignInError(): string | null {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SIGN_IN_FAILED_PARAM)) return null;
  const error = url.searchParams.get("error");
  for (const name of [SIGN_IN_FAILED_PARAM, "error", "error_description"]) url.searchParams.delete(name);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return error === "access_denied" ? "ログインを中断しました。" : "ログインできませんでした。もう一度お試しください。";
}

const signInError = takeSignInError();

/**
 * どのページでも、アプリの根で 1 つだけ動かす、本人に関わる処理。描くのは、ログインの中断を知らせるトーストだけ。
 * - ログインしているとわかったら、このブラウザの控え (ログインせずに使った一覧) を消す。ほかのタブでログインした場合も、次に開いた画面で消える。
 * - ゲストとわかったら、前の一覧を交換する (一時的)。
 */
export function SessionEffects() {
  const { data: session, isPending } = authClient.useSession();
  const loggedIn = !!session;
  const [toast, setToast] = useState(signInError);

  useEffect(() => {
    if (isPending) return;
    if (loggedIn) clearMyEvents();
    else ensureLegacyExchanged();
  }, [isPending, loggedIn]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="toast toast-top toast-center z-50" aria-live="polite" aria-atomic="true">
      <div className="alert alert-info text-sm">
        <span>{toast}</span>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="btn btn-circle btn-ghost btn-xs"
          aria-label="閉じる"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
