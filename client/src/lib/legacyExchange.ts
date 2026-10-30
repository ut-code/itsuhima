// 前の browserId からの移行のためだけにある (一時的)。交換の期限が来たら、このファイルごと消す。

import { hc } from "hono/client";
import type { AppType } from "../../../server/src/routes/api";
import { API_ENDPOINT } from "../utils";
import { rememberMyEvents } from "./myEvents";

const client = hc<AppType>(API_ENDPOINT);

/** 前の一覧を控えに移したか。リクエストを減らすための印だけで、どの操作でも消さない */
const LEGACY_EXCHANGED_KEY = "itsuhima:legacyExchanged";

function isLegacyExchanged() {
  try {
    return localStorage.getItem(LEGACY_EXCHANGED_KEY) !== null;
  } catch (_) {
    // localStorage が使えないなら、交換しても控えられない
    return true;
  }
}

function markLegacyExchanged() {
  try {
    localStorage.setItem(LEGACY_EXCHANGED_KEY, "1");
  } catch (error) {
    console.error("Failed to mark legacy exchanged:", error);
  }
}

let exchanging: Promise<void> | null = null;

/**
 * 前の一覧 (browserId でサーバーが持っていたもの) を、一度だけ控えに移す。ゲストのときだけ呼ぶ (ログイン中に交換すると、
 * 印が立って、ログアウトした後に前の一覧が出なくなる)。アプリの根 (`App.tsx`) がどのページでも最初に呼び、
 * 控えを読むところ (ホーム) は、同じ交換が終わるのを待つ。失敗したら印を立てず、次に開いたときにやり直す。
 */
export function ensureLegacyExchanged(): Promise<void> {
  if (isLegacyExchanged()) return Promise.resolve();
  exchanging ??= (async () => {
    try {
      const res = await client.legacy.exchange.$post();
      if (res.status !== 200) return;
      rememberMyEvents(await res.json());
      markLegacyExchanged();
    } catch (error) {
      console.error("Error exchanging legacy events:", error);
    } finally {
      exchanging = null;
    }
  })();
  return exchanging;
}

/** ゲストがこのブラウザの記録を削除したとき。前の一覧の行と browserId の Cookie を消し、交換しないようにする */
export async function forgetLegacyBrowser() {
  const res = await client.legacy.browser.$delete();
  if (!res.ok) throw new Error("Failed to forget legacy browser");
  markLegacyExchanged();
}
