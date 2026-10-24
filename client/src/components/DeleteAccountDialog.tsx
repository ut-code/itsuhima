import { type RefObject, useState } from "react";
import { authClient, signInWithGoogle } from "../lib/auth";

type DeleteError = "session_expired" | "unknown";

/**
 * アカウントを削除する確認のダイアログ。開くのは呼び出し側 (`ref.current.showModal()`)。
 * 消しても、作ったイベントと回答は残り、誰も操作できなくなる (サーバーの participant.userId が null になる)。
 */
export default function DeleteAccountDialog({ ref }: { ref: RefObject<HTMLDialogElement | null> }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<DeleteError | null>(null);

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
    // ログインしているときだけ見えていたイベントを消すため、読み込み直す
    window.location.reload();
  };

  return (
    <dialog ref={ref} className="modal" onClose={() => setError(null)}>
      <div className="modal-box">
        <h3 className="mb-3 font-bold text-base-content text-lg">アカウントを削除しますか？</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-base-content/70 text-sm">
          <li>
            作成したイベントと回答は、消えずに残ります。回答の名前とコメントも、ほかの参加者に表示されたままです。
          </li>
          <li>
            削除した後は、作成したイベントの編集・削除や、回答の編集ができなくなります。イベントを消したいときは、先にイベントの画面から削除してください。
          </li>
          <li>この操作は取り消せません。</li>
        </ul>
        {error === "session_expired" && (
          <div className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            <p className="text-base-content/80">安全のため、ログインし直してから削除してください。</p>
            <button type="button" className="btn btn-sm btn-outline mt-2" onClick={() => signInWithGoogle()}>
              Google でログインし直す
            </button>
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
