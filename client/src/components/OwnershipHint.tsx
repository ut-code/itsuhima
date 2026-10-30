import { LuInfo, LuLock } from "react-icons/lu";
import { authClient, loggedInLabel, useAccountEmail } from "../lib/auth";
import { useSignIn } from "./SignInWarning";

const TARGET_LABEL = { event: "イベント", answer: "回答" } as const;

/**
 * 作るもの (イベント・回答) を誰が編集できるかを知らせる。
 * ログインしていれば本人だけ、していなければ URL を知っている人は誰でも編集できる。
 * @param showLoginButton ログインのボタンを出す (Google のページに移るので、入力の前の画面でだけ出す)
 */
export function OwnershipHint({
  target,
  showLoginButton = false,
}: {
  target: keyof typeof TARGET_LABEL;
  showLoginButton?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const email = useAccountEmail(!!session);
  const { signIn, dialog } = useSignIn();
  if (isPending) return null;
  const label = TARGET_LABEL[target];

  if (session) {
    return (
      <p className="flex items-start gap-2 text-base-content/70 text-sm">
        <LuLock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {loggedInLabel(email)}なので、あなただけが編集できる{label}になります。
        </span>
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2 text-base-content/70 text-sm">
      <LuInfo className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        ログインしていないので、URL を知っている人は誰でもこの{label}を編集できます。
        {showLoginButton ? (
          <>
            <button type="button" className="link link-primary" onClick={() => signIn()}>
              Google でログイン
            </button>
            してから作ると、あなただけが編集できます。
          </>
        ) : (
          "ログインしてから回答すると、あなただけが編集できます。"
        )}
      </p>
      {dialog}
    </div>
  );
}
