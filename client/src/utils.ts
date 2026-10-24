/** API は同じオリジンの `/api` にある。ローカルの開発では Vite が wrangler dev にプロキシする */
export const API_ENDPOINT = "/api";
export const FRONTEND_ORIGIN = import.meta.env.VITE_FRONTEND_ORIGIN || "http://localhost:5173";

/**
 * エラーレスポンスの `{ message }` を読む。読めなければ `fallback` を返す。
 * サーバーの onError やミドルウェアが返すエラーは Hono RPC の型に乗らないので、型を付けずに読む。
 */
export async function readErrorMessage(res: { json(): Promise<unknown> }, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message.trim() || fallback;
    }
  } catch (_) {
    // レスポンスがJSONでない場合は無視
  }
  return fallback;
}
