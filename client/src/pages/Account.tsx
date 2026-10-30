import { hc } from "hono/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppType } from "../../../server/src/routes/api";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { authClient, signInWithGoogle } from "../lib/auth";
import dayjs from "../lib/dayjs";
import { API_ENDPOINT, readErrorMessage } from "../utils";
import { SCOPE_LABELS } from "./oauth/Consent";

const client = hc<AppType>(API_ENDPOINT);

type Connection = {
  clientId: string;
  name: string | null;
  redirectHosts: string[];
  scopes: string[];
  updatedAt: string;
};

/** アカウントのページ。ログインの状態、MCP で接続中のアプリ、アカウントの削除 */
export default function AccountPage() {
  const { data: session, isPending } = authClient.useSession();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="flex min-h-screen flex-col bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <h1 className="font-bold text-2xl tracking-tight">アカウント</h1>
        {isPending ? (
          <div className="skeleton h-32 w-full" />
        ) : !session ? (
          <section className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm">
            <p className="text-base-content/70 text-sm">
              ログインすると、作成したイベントと回答をあなただけが編集でき、別の端末や AI
              アシスタントからも操作できます。
            </p>
            <button type="button" className="btn btn-primary mt-4" onClick={() => signInWithGoogle()}>
              Google でログイン
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm">
              <h2 className="font-bold text-lg">ログイン</h2>
              <p className="mt-2 text-base-content/70 text-sm">Google でログイン中</p>
            </section>
            <Connections />
            <section className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm">
              <h2 className="font-bold text-lg">アカウントの削除</h2>
              <p className="mt-2 text-base-content/70 text-sm">
                作成したイベントと回答は残り、URL を知っている人なら誰でも編集できるようになります。
              </p>
              <button
                type="button"
                className="btn btn-sm btn-outline btn-error mt-4"
                onClick={() => deleteDialogRef.current?.showModal()}
              >
                アカウントを削除
              </button>
              <DeleteAccountDialog ref={deleteDialogRef} />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

/** MCP で接続中のアプリの一覧と、接続を切るボタン */
function Connections() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await client.me.connections.$get();
      if (res.status !== 200) throw new Error(await readErrorMessage(res, "接続中のアプリを読み込めませんでした。"));
      setConnections(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "ネットワークエラーが発生しました。");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (clientId: string) => {
    setRevoking(clientId);
    try {
      const res = await client.me.connections[":clientId"].$delete({ param: { clientId } });
      if (!res.ok) throw new Error(await readErrorMessage(res, "接続を切れませんでした。"));
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "ネットワークエラーが発生しました。");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <section className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm">
      <h2 className="font-bold text-lg">接続中のアプリ</h2>
      <p className="mt-2 text-base-content/70 text-sm">
        MCP で、あなたとしてイツヒマを操作できる AI アシスタントなどです。心当たりのないものは、接続を切ってください。
      </p>
      {error && <p className="mt-3 text-error text-sm">{error}</p>}
      {connections === null ? (
        !error && <div className="skeleton mt-4 h-16 w-full" />
      ) : connections.length === 0 ? (
        <p className="mt-4 text-base-content/50 text-sm">接続中のアプリはありません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-base-200">
          {connections.map((c) => (
            <li key={c.clientId} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{c.name ?? "不明なアプリ"}</p>
                <p className="text-base-content/60">
                  戻り先: <span className="font-mono">{c.redirectHosts.join(", ") || "(不明)"}</span>
                </p>
                <p className="text-base-content/60">
                  できること: {c.scopes.map((s) => SCOPE_LABELS[s] ?? s).join("、")}
                </p>
                <p className="text-base-content/60">許可した日時: {dayjs(c.updatedAt).format("YYYY年M月D日 HH:mm")}</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline shrink-0"
                disabled={revoking !== null}
                onClick={() => revoke(c.clientId)}
              >
                {revoking === c.clientId && <span className="loading loading-spinner loading-xs" />}
                接続を切る
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
