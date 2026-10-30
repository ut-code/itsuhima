import { useEffect } from "react";
import Header from "../components/Header";
import { useSignIn } from "../components/SignInWarning";
import { authClient } from "../lib/auth";

/**
 * MCP クライアント (Claude など) と接続するときのログイン画面。
 * 認可サーバー (/api/auth/oauth2/authorize) が、ログインしていない利用者をここに送る。
 * クエリには、署名付きの認可のリクエストが入っている。ログインした後に、同じクエリで認可に戻す。
 */
export default function LoginPage() {
  const { data: session, isPending } = authClient.useSession();
  const { signIn, dialog } = useSignIn();
  const resumeUrl = `/api/auth/oauth2/authorize${window.location.search}`;

  useEffect(() => {
    // すでにログインしていれば、そのまま認可に戻る
    if (session) window.location.replace(resumeUrl);
  }, [session, resumeUrl]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
          <h1 className="mb-3 font-bold text-xl">ログイン</h1>
          <p className="mb-6 text-base-content/70 text-sm">
            AI アシスタントからあなたとしてイツヒマを使うには、ログインが必要です。
          </p>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={isPending || !!session}
            onClick={() => signIn(resumeUrl)}
          >
            Google でログイン
          </button>
          {dialog}
        </div>
      </main>
    </div>
  );
}
