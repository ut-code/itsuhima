import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { signInWithGoogle } from "../lib/auth";
import { loadMyEvents } from "../lib/myEvents";
import { RememberedEventLinks } from "./RememberedEventLinks";

/**
 * Google でログインする。このブラウザの控え (ログインせずに使った一覧) があれば、ログインすると消えることを
 * 確かめてから進む。ログインの入口は、すべてこれを使う。
 * 返す dialog を、呼び出し側で描く。
 */
export function useSignIn(): { signIn: (callbackURL?: string) => void; dialog: ReactNode } {
  /** 確かめているログイン。callbackURL は、押したときのページ */
  const [pending, setPending] = useState<{ callbackURL: string; eventIds: string[] } | null>(null);

  const signIn = useCallback((callbackURL = window.location.pathname + window.location.search) => {
    const eventIds = loadMyEvents().map((e) => e.id);
    if (eventIds.length === 0) {
      signInWithGoogle(callbackURL);
      return;
    }
    setPending({ callbackURL, eventIds });
  }, []);

  const dialog = pending && (
    <SignInWarningDialog
      eventIds={pending.eventIds}
      onConfirm={() => signInWithGoogle(pending.callbackURL)}
      onClose={() => setPending(null)}
    />
  );
  return { signIn, dialog };
}

/** ログインすると消える一覧と、ログインせずに作ったものがどうなるかを出す */
function SignInWarningDialog({
  eventIds,
  onConfirm,
  onClose,
}: {
  eventIds: string[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="mb-3 font-bold text-base-content text-lg">ログインしますか？</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-base-content/70 text-sm">
          <li>
            このブラウザのホームに出ているイベントの一覧 ({eventIds.length} 件)
            は、ログインすると消えます。イベントそのものは消えないので、URL があれば開けます。
          </li>
          <li>
            ログインせずに作ったイベントと回答は、アカウントのものにはなりません。URL
            を知っている人は誰でも編集できるまま残ります。
          </li>
          <li>ログインしてから同じイベントに回答すると、前の回答と 2 つ並びます。前の回答は自分で削除できます。</li>
        </ul>
        <RememberedEventLinks eventIds={eventIds} />
        <div className="modal-action">
          <button type="button" className="btn btn-outline" disabled={signingIn} onClick={() => ref.current?.close()}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-primary gap-1.5"
            disabled={signingIn}
            onClick={() => {
              setSigningIn(true);
              onConfirm();
            }}
          >
            {signingIn && <span className="loading loading-spinner loading-sm" />}
            ログインする
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">閉じる</button>
      </form>
    </dialog>
  );
}
