import { useEffect, useRef, useState } from "react";
import { LuCircleUserRound } from "react-icons/lu";
import { authClient, signInWithGoogle } from "../lib/auth";
import DeleteAccountDialog from "./DeleteAccountDialog";

/**
 * ヘッダーの右端に置く、アカウントのアイコンとドロップダウン。ログインは任意。
 * ログインすると、このブラウザで作ったイベントや回答を、別の端末からも操作できる。
 */
export default function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const size = compact ? "h-6 w-6" : "h-8 w-8";
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  // 外側を押すか Esc で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (isPending) return <div className={`skeleton ${size} shrink-0 rounded-full`} />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="アカウント"
        aria-expanded={isOpen}
        className="btn btn-ghost btn-circle btn-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {session ? (
          <Avatar user={session.user} size={size} />
        ) : (
          <LuCircleUserRound className={`${size} text-base-content/60`} />
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
          {session ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar user={session.user} size="h-10 w-10" />
                <div className="min-w-0">
                  <div className="truncate font-medium text-base-content text-sm">{session.user.name}</div>
                  <div className="truncate text-base-content/60 text-xs">{session.user.email}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline mt-4 w-full"
                onClick={async () => {
                  await authClient.signOut();
                  // ログインしているときだけ見えていたイベントを消すため、読み込み直す
                  window.location.reload();
                }}
              >
                ログアウト
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs mt-2 w-full text-error"
                onClick={() => {
                  setIsOpen(false);
                  deleteDialogRef.current?.showModal();
                }}
              >
                アカウントを削除
              </button>
            </>
          ) : (
            <>
              <p className="text-base-content/70 text-sm">
                ログインすると、作成したイベントや回答を、別の端末からも操作できます。
              </p>
              <button type="button" className="btn btn-sm btn-outline mt-4 w-full" onClick={() => signInWithGoogle()}>
                Google でログイン
              </button>
            </>
          )}
        </div>
      )}
      {session && <DeleteAccountDialog ref={deleteDialogRef} />}
    </div>
  );
}

/** Google のプロフィール画像。無いときや読み込めないときは、名前の頭文字を出す */
function Avatar({ user, size }: { user: { name: string; image?: string | null }; size: string }) {
  const [failed, setFailed] = useState(false);

  if (user.image && !failed) {
    return (
      <img
        src={user.image}
        alt=""
        // Google の画像は Referer が付いていると 403 になることがある
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-primary text-primary-content text-sm`}>
      {user.name.slice(0, 1)}
    </span>
  );
}
