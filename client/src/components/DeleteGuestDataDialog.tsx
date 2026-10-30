import { hc } from "hono/client";
import { useEffect, useRef, useState } from "react";
import type { AppType } from "../../../server/src/routes/api";
import { clearMyEvents, isLegacyExchanged, loadMyEvents, markLegacyExchanged } from "../lib/myEvents";
import { API_ENDPOINT } from "../utils";
import { RememberedEventLinks } from "./RememberedEventLinks";

const client = hc<AppType>(API_ENDPOINT);

/**
 * ゲスト (ログインしていない人) が、このブラウザの記録を削除する。ログイン中のアカウントの削除に当たる。
 * 消すのは、ホームの一覧の控え、前の一覧 (未交換なら交換して捨てる)、`/` から `/home` に飛ぶための Cookie。
 * イベントと回答はサーバーに残る (URL を知っている人は誰でも編集できるので、本人のものとは決められない)。
 */
async function deleteGuestData() {
  if (!isLegacyExchanged()) {
    // 前の一覧がサーバーに残っていれば、交換して捨てる (サーバーの行は交換で消える)
    const res = await client.legacy.exchange.$post();
    if (res.status !== 200) throw new Error("Failed to exchange legacy events");
    markLegacyExchanged();
  }
  clearMyEvents();
  const res = await client.visited.$delete();
  if (!res.ok) throw new Error("Failed to delete visited cookie");
}

/** 確かめてから、このブラウザの記録を削除する。描くと開き、閉じると onClose を呼ぶ */
export default function DeleteGuestDataDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [eventIds] = useState(() => loadMyEvents().map((e) => e.id));
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="mb-3 font-bold text-base-content text-lg">このブラウザの記録を削除しますか？</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-base-content/70 text-sm">
          <li>
            {`このブラウザのホームに出ているイベントの一覧${eventIds.length > 0 ? ` (${eventIds.length} 件) ` : ""}を削除します。元に戻せません。`}
          </li>
          <li>
            作成したイベントと回答そのものは削除されません。URL
            を知っている人は誰でも開いて編集できるまま残ります。残したくないものは、先にそれぞれのページから削除してください。
          </li>
        </ul>
        {eventIds.length > 0 && <RememberedEventLinks eventIds={eventIds} />}
        {error && (
          <p className="mt-2 text-error text-sm">削除できませんでした。時間をおいて、もう一度お試しください。</p>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-outline" disabled={isDeleting} onClick={() => ref.current?.close()}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn gap-1.5 bg-error text-white hover:bg-error/90"
            disabled={isDeleting}
            onClick={async () => {
              setIsDeleting(true);
              setError(false);
              try {
                await deleteGuestData();
                // 初めて来たときと同じ画面に戻す
                window.location.assign("/");
              } catch (e) {
                console.error(e);
                setError(true);
                setIsDeleting(false);
              }
            }}
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
