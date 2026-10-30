import { useEffect, useRef, useState } from "react";
import { LuCircleUserRound } from "react-icons/lu";
import { NavLink } from "react-router";
import { authClient, loggedInLabel, useAccountEmail } from "../lib/auth";
import DeleteGuestDataDialog from "./DeleteGuestDataDialog";
import { useSignIn } from "./SignInWarning";

/**
 * ヘッダーの右端に置く、アカウントのメニュー。ログインは任意。
 * ログインしていなければ「ゲスト」として、ログインと、このブラウザの記録の削除 (ログアウトとアカウントの削除に当たる) を出す。
 * メールアドレスは DB に保存せず、このブラウザでログインしたときの Cookie から出す (`useAccountEmail`)。
 */
export default function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const email = useAccountEmail(!!session);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signIn, dialog } = useSignIn();
  const [isDeletingGuestData, setIsDeletingGuestData] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="アカウント"
        aria-expanded={isOpen}
        className="btn btn-ghost btn-circle btn-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LuCircleUserRound className={`${size} ${session ? "text-primary" : "text-base-content/60"}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
          {session ? (
            <>
              <p className="break-all text-base-content/70 text-sm">{loggedInLabel(email)}</p>
              <NavLink to="/account" className="btn btn-sm btn-outline mt-3 w-full" onClick={() => setIsOpen(false)}>
                アカウントと接続中のアプリ
              </NavLink>
              <button
                type="button"
                className="btn btn-sm btn-ghost mt-2 w-full"
                disabled={isSigningOut}
                onClick={async () => {
                  setIsSigningOut(true);
                  setSignOutFailed(false);
                  const { error } = await authClient.signOut();
                  if (error) {
                    setSignOutFailed(true);
                    setIsSigningOut(false);
                    return;
                  }
                  // 初めて来たときと同じ画面に戻す (ログインしているときだけ見えていたものも消える)
                  window.location.assign("/");
                }}
              >
                {isSigningOut && <span className="loading loading-spinner loading-sm" />}
                ログアウト
              </button>
              {signOutFailed && (
                <p className="mt-2 text-error text-xs">ログアウトできませんでした。もう一度お試しください。</p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium text-base-content text-sm">ゲストとして利用中</p>
              <p className="mt-1 text-base-content/60 text-xs">
                ログインすると、作成したイベントと回答をあなただけが編集でき、別の端末からも使えます。
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary mt-3 w-full"
                onClick={() => {
                  setIsOpen(false);
                  signIn();
                }}
              >
                Google でログイン
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost mt-2 w-full text-error"
                onClick={() => {
                  setIsOpen(false);
                  setIsDeletingGuestData(true);
                }}
              >
                このブラウザの記録を削除
              </button>
            </>
          )}
        </div>
      )}
      {dialog}
      {isDeletingGuestData && <DeleteGuestDataDialog onClose={() => setIsDeletingGuestData(false)} />}
    </div>
  );
}
