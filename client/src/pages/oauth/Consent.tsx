import { useEffect, useState } from "react";
import Header from "../../components/Header";
import { authClient } from "../../lib/auth";

/** スコープの説明。知らないスコープはそのまま出す */
const SCOPE_LABELS: Record<string, string> = {
  read: "あなたが関わるイベントと、その回答を見る",
  submit: "あなたとして、イベントに回答する・回答を変える",
  create: "あなたとして、イベントを作る・変える・消す",
  openid: "あなたのアカウントを識別する",
  profile: "名前とプロフィール画像を見る",
  email: "メールアドレスを見る",
  offline_access: "あなたが使っていない間も、接続を保つ",
};

/** localhost などのループバック (自分の PC の中で動くアプリ) か */
function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * MCP クライアント (Claude など) にイツヒマの操作を許可するかの同意画面。
 * 認可サーバーが、署名付きの認可のリクエストをクエリに付けてここに送る。
 * クライアント名は誰でも名乗れるので、戻り先 (redirect_uri) のホスト名も出して、利用者が見分けられるようにする。
 */
export default function ConsentPage() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client_id") ?? "";
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
  const redirectHost = (() => {
    try {
      return new URL(params.get("redirect_uri") ?? "").hostname;
    } catch {
      return "";
    }
  })();

  const { data: session, isPending } = authClient.useSession();
  const [clientName, setClientName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !clientId) return;
    fetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((client: { client_name?: string } | null) => setClientName(client?.client_name ?? null))
      .catch(() => setClientName(null));
  }, [session, clientId]);

  const respond = async (accept: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError("処理できませんでした。接続をはじめからやり直してください。");
      setSubmitting(false);
    }
  };

  if (isPending) return null;

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-base-300 bg-base-100 p-8 shadow-sm">
          {!session ? (
            <p className="text-center text-sm">ログインの期限が切れました。接続をはじめからやり直してください。</p>
          ) : (
            <>
              <h1 className="mb-2 font-bold text-xl">
                「{clientName ?? "不明なアプリ"}」にイツヒマの操作を許可しますか？
              </h1>
              <p className="mb-4 text-base-content/70 text-sm">
                {session.user.name} ({session.user.email}) としてログインしています。
              </p>
              <dl className="mb-4 rounded-lg bg-base-200 p-3 text-sm">
                <dt className="text-base-content/60">許可した後に戻る先</dt>
                <dd className="font-mono">{redirectHost || "(不明)"}</dd>
              </dl>
              {isLoopback(redirectHost) && (
                <p className="mb-4 rounded-lg bg-warning/20 p-3 text-sm">
                  戻る先が、この PC の中で動くアプリ ({redirectHost})
                  です。自分で接続を始めたのでなければ、許可しないでください。
                </p>
              )}
              <p className="mb-2 font-medium text-sm">このアプリにできるようになること</p>
              <ul className="mb-6 list-disc pl-5 text-sm">
                {scopes.map((scope) => (
                  <li key={scope}>{SCOPE_LABELS[scope] ?? scope}</li>
                ))}
              </ul>
              {error && <p className="mb-4 text-error text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => respond(false)}>
                  許可しない
                </button>
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => respond(true)}>
                  許可する
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
