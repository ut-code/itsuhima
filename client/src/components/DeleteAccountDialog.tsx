import { hc } from "hono/client";
import { type RefObject, useEffect, useState } from "react";
import type { AppType } from "../../../server/src/routes/api";
import { authClient } from "../lib/auth";
import { API_ENDPOINT } from "../utils";
import { useSignIn } from "./SignInWarning";

const client = hc<AppType>(API_ENDPOINT);

type DeleteError = "session_expired" | "unknown";

/**
 * アカウントを削除する確認のダイアログ。開くのは呼び出し側 (`ref.current.showModal()`)。
 * 消すと、作ったイベントは (ほかの人の回答ごと) 消える。ほかの人のイベントへの回答は
 * 「削除されたアカウント」の回答として残り、誰も編集できなくなる。
 */
export default function DeleteAccountDialog({ ref }: { ref: RefObject<HTMLDialogElement | null> }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<DeleteError | null>(null);
  /** 消えるイベントと、残る回答の数。読めなければ null */
  const { signIn, dialog } = useSignIn();
  const [counts, setCounts] = useState<{ hosted: number; answered: number } | null>(null);

  useEffect(() => {
    client.me.events
      .$get()
      .then(async (res) => {
        if (res.status !== 200) return;
        const events = await res.json();
        setCounts({
          hosted: events.filter((e) => e.isHost).length,
          answered: events.filter((e) => !e.isHost && e.participantId !== null).length,
        });
      })
      .catch(() => setCounts(null));
  }, []);

  const deleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    const { error } = await authClient.deleteUser({});
    if (error) {
      // パスワードがないので、ログインしてから時間が経ったセッションでは消せない (Better Auth の freshAge)
      setError(error.code === "SESSION_EXPIRED" ? "session_expired" : "unknown");
      setIsDeleting(false);
      return;
    }
    // 初めて来たときと同じ画面に戻す
    window.location.assign("/");
  };

  return (
    <dialog ref={ref} className="modal" onClose={() => setError(null)}>
      <div className="modal-box">
        <h3 className="mb-3 font-bold text-base-content text-lg">アカウントを削除しますか？</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-base-content/70 text-sm">
          <li>
            ログインして作成したイベント{counts ? ` (${counts.hosted} 件)` : ""}
            は、ほかの人の回答も含めて削除されます。元に戻せません。
          </li>
          <li>
            ほかの人のイベントへの回答{counts ? ` (${counts.answered} 件)` : ""}
            は、名前・コメント・日程が「削除されたアカウント」の回答として残り、誰も編集できなくなります。イベントを編集できる人は、削除できます。残したくない回答は、先に削除してください。
          </li>
          <li>MCP で接続しているアプリも、使えなくなります。</li>
          <li>この操作は取り消せません。</li>
        </ul>
        {error === "session_expired" && (
          <div className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            <p className="text-base-content/80">安全のため、ログインし直してから削除してください。</p>
            <button type="button" className="btn btn-sm btn-outline mt-2" onClick={() => signIn()}>
              Google でログインし直す
            </button>
            {dialog}
          </div>
        )}
        {error === "unknown" && (
          <p className="mb-2 text-error text-sm">削除できませんでした。時間をおいて、もう一度お試しください。</p>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-outline" disabled={isDeleting} onClick={() => ref.current?.close()}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn gap-1.5 bg-error text-white hover:bg-error/90"
            disabled={isDeleting}
            onClick={deleteAccount}
          >
            {isDeleting && <span className="loading loading-spinner loading-sm" />}
            削除する
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">閉じる</button>
      </form>
    </dialog>
  );
}
