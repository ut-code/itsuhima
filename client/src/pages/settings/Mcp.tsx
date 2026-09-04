import { hc } from "hono/client";
import { useCallback, useEffect, useState } from "react";
import { LuBot, LuCheck, LuCopy, LuKeyRound, LuRefreshCw, LuTrash2, LuTriangleAlert } from "react-icons/lu";
import type { AppType } from "../../../../server/src/main";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import dayjs from "../../lib/dayjs";
import { API_ENDPOINT } from "../../utils";

const client = hc<AppType>(API_ENDPOINT);

/** 本番では VITE_API_ENDPOINT が "/api" のような相対パスになるため、絶対 URL に直す */
function absoluteApiOrigin(): string {
  if (/^https?:\/\//.test(API_ENDPOINT)) return API_ENDPOINT;
  return `${window.location.origin}${API_ENDPOINT}`;
}

type Token = {
  id: string;
  prefix: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type PairingCode = { code: string; expiresAt: string };

const SCOPE_LABELS: Record<string, string> = {
  read: "閲覧",
  submit: "日程の提出",
  create: "イベント作成",
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm gap-1"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={label}
    >
      {copied ? <LuCheck className="h-4 w-4 text-success" /> : <LuCopy className="h-4 w-4" />}
      {copied ? "コピーしました" : "コピー"}
    </button>
  );
}

export default function McpSettingsPage() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const notify = (message: string, variant: "success" | "error") => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.me.tokens.$get({}, { init: { credentials: "include" } });
      if (res.status === 200) {
        setTokens((await res.json()) as Token[]);
      } else {
        notify("トークンの取得に失敗しました。", "error");
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
      notify("ネットワークエラーが発生しました。", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // 連携コードの残り時間を 1 秒ごとに更新する
  useEffect(() => {
    if (!pairingCode) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(pairingCode.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) setPairingCode(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pairingCode]);

  const issuePairingCode = async () => {
    setIssuing(true);
    try {
      const res = await client.me["pairing-codes"].$post({}, { init: { credentials: "include" } });
      if (res.status === 201) {
        setPairingCode((await res.json()) as PairingCode);
      } else {
        notify("連携コードの発行に失敗しました。", "error");
      }
    } catch (error) {
      console.error("Error issuing pairing code:", error);
      notify("ネットワークエラーが発生しました。", "error");
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (token: Token) => {
    if (!window.confirm(`トークン「${token.name}」を失効しますか？この操作は取り消せません。`)) return;
    try {
      const res = await client.me.tokens[":tokenId"].$delete(
        { param: { tokenId: token.id } },
        { init: { credentials: "include" } },
      );
      if (res.status === 200) {
        notify("トークンを失効しました。", "success");
        await fetchTokens();
      } else {
        notify("トークンの失効に失敗しました。", "error");
      }
    } catch (error) {
      console.error("Error revoking token:", error);
      notify("ネットワークエラーが発生しました。", "error");
    }
  };

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        itsuhima: {
          command: "npx",
          args: ["-y", "itsuhima-mcp"],
          env: { ITSUHIMA_PAIRING_CODE: pairingCode?.code ?? "＜連携コード＞" },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="flex min-h-screen flex-col bg-base-200 text-base-content">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 font-bold text-2xl">
            <LuBot className="h-6 w-6 text-primary" />
            AI 連携（MCP）
          </h1>
          <p className="mt-2 text-base-content/70 text-sm">
            ChatGPT や Claude からイツヒマのイベントを確認したり、日程を提出したりできます。
          </p>
        </div>

        {/* 手順 1: 連携コード */}
        <section className="card mb-6 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">1. 連携コードを発行する</h2>
            <p className="text-base-content/70 text-sm">
              このブラウザのイベントを AI から扱えるようにするためのコードです。有効期限は 10 分、1 回だけ使えます。
            </p>

            {pairingCode ? (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold font-mono text-3xl tracking-[0.3em]">{pairingCode.code}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base-content/60 text-sm">
                      残り {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
                    </span>
                    <CopyButton text={pairingCode.code} label="連携コードをコピー" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-actions mt-4">
                <button type="button" className="btn btn-primary gap-2" onClick={issuePairingCode} disabled={issuing}>
                  {issuing ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <LuKeyRound className="h-4 w-4" />
                  )}
                  連携コードを発行
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 手順 2: クライアント設定 */}
        <section className="card mb-6 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">2. AI クライアントに設定する</h2>

            <h3 className="mt-2 font-semibold text-sm">Claude Code / Claude Desktop / Cursor</h3>
            <p className="text-base-content/70 text-sm">設定ファイルに次を追加します。</p>
            <div className="mockup-code mt-2 text-xs">
              <pre className="px-4">
                <code>{mcpConfig}</code>
              </pre>
            </div>
            <div className="flex justify-end">
              <CopyButton text={mcpConfig} label="設定をコピー" />
            </div>

            <h3 className="mt-4 font-semibold text-sm">ChatGPT / Claude.ai のコネクタ</h3>
            <p className="text-base-content/70 text-sm">
              リモート MCP サーバーの URL に次を指定し、連携コードで認証します。
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-base-200 px-4 py-3">
              <code className="flex-1 break-all text-sm">{`${absoluteApiOrigin()}/mcp`}</code>
              <CopyButton text={`${absoluteApiOrigin()}/mcp`} label="URL をコピー" />
            </div>
          </div>
        </section>

        {/* トークン一覧 */}
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">連携中のクライアント</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                onClick={fetchTokens}
                aria-label="再読み込み"
              >
                <LuRefreshCw className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner" />
              </div>
            ) : !tokens || tokens.length === 0 ? (
              <p className="py-8 text-center text-base-content/50 text-sm">連携中のクライアントはありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>権限</th>
                      <th>最終使用</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <tr key={token.id}>
                        <td>
                          <div className="font-medium">{token.name}</div>
                          <div className="font-mono text-base-content/50 text-xs">{token.prefix}…</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {token.scopes.map((scope) => (
                              <span key={scope} className="badge badge-ghost badge-sm">
                                {SCOPE_LABELS[scope] ?? scope}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-base-content/70 text-xs">
                          {token.lastUsedAt ? dayjs.utc(token.lastUsedAt).tz().format("YYYY/MM/DD HH:mm") : "未使用"}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() => revoke(token)}
                            aria-label={`${token.name} を失効`}
                          >
                            <LuTrash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
              <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-base-content/70">
                トークンを持つ AI
                クライアントは、このブラウザで作成・参加したイベントを閲覧・操作できます。使わなくなったクライアントは失効してください。
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {toast && (
        <div className="toast toast-center toast-top z-50">
          <div className={`alert ${toast.variant === "success" ? "alert-success" : "alert-error"}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
