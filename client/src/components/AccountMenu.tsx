import { useEffect, useRef, useState } from "react";
import { LuCircleUserRound } from "react-icons/lu";
import { NavLink } from "react-router";
import { authClient, loggedInLabel, signInWithGoogle, useAccountEmail } from "../lib/auth";

/**
 * ヘッダーの右端に置く、ログインのボタンとアカウントのメニュー。ログインは任意。
 * メールアドレスは DB に保存せず、このブラウザでログインしたときの Cookie から出す (`useAccountEmail`)。
 */
export default function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const email = useAccountEmail(!!session);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const size = compact ? "h-5 w-5" : "h-6 w-6";
  if (isPending) return <div className={`skeleton ${size} shrink-0 rounded-full`} />;

  if (!session) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => signInWithGoogle()}>
        ログイン
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="アカウント"
        aria-expanded={isOpen}
        className="btn btn-ghost btn-circle btn-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LuCircleUserRound className={`${size} text-primary`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
          <p className="break-all text-base-content/70 text-sm">{loggedInLabel(email)}</p>
          <NavLink to="/account" className="btn btn-sm btn-outline mt-3 w-full" onClick={() => setIsOpen(false)}>
            アカウントと接続中のアプリ
          </NavLink>
          <button
            type="button"
            className="btn btn-sm btn-ghost mt-2 w-full"
            onClick={async () => {
              await authClient.signOut();
              // ログインしているときだけ見えていたイベントを消すため、読み込み直す
              window.location.reload();
            }}
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
