export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "http://localhost:3000";
export const FRONTEND_ORIGIN = import.meta.env.VITE_FRONTEND_ORIGIN || "http://localhost:5173";

/**
 * エラーレスポンスから message を取り出す。
 *
 * 業務エラーはサーバーのユースケース層から throw され onError でまとめて返るため、
 * Hono RPC の型（成功時のレスポンス）には乗らない。よってここでキャストして読む。
 */
export async function extractErrorMessage(res: { json: () => Promise<unknown> }, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown } | null;
    if (data && typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
  } catch (_) {
    // レスポンスが JSON でない場合は無視
  }
  return fallback;
}
