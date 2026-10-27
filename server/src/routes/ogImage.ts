import type { Context } from "hono";
import type { AppEnv } from "../env.js";

/**
 * イベントの OG 画像。本体は og/handler.tsx。
 * 画像の生成 (wasm など) は初期化が重いので、/og に来たときだけ初期化する。ほかのリクエストのコールドスタートを遅くしない。
 * そのため、このファイルは軽いものしか静的に import しない。
 */
export async function ogImage(c: Context<AppEnv, "/og/:eventId">) {
  const { handleOgImage } = await import("../og/handler.js");
  return handleOgImage(c);
}
