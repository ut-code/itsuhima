import { authClient, LOGIN_ENABLED, signInWithGoogle } from "../lib/auth";

/**
 * ログインの状態と、ログイン・ログアウトのボタン。ログインは任意。
 * ログインすると、このブラウザで作ったイベントや回答を、別の端末からも操作できる。
 */
export default function AccountMenu({ className = "" }: { className?: string }) {
  if (!LOGIN_ENABLED) return null;
  return <AccountMenuInner className={className} />;
}

function AccountMenuInner({ className }: { className: string }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    return (
      <button type="button" className={`btn btn-sm btn-outline ${className}`} onClick={() => signInWithGoogle()}>
        Google でログイン
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-base-content/70">{session.user.name}</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          await authClient.signOut();
          // ログインしているときだけ見えていたイベントを消すため、読み込み直す
          window.location.reload();
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
