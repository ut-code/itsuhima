import { hc } from "hono/client";
import type { AppType } from "../../../server/src/routes/api";
import { API_ENDPOINT, readErrorMessage } from "../utils";

const client = hc<AppType>(API_ENDPOINT);

/** 一度に引けるイベントの数 (サーバーの `GET /events?ids=` の上限) */
const MAX_EVENT_IDS = 100;

/**
 * id のイベントの名前・日程・削除したか (`GET /events?ids=`)。上限を超える分は分けて引く。
 * 完全に消えたイベントは返らない。
 */
export async function fetchEventsByIds(ids: string[]) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += MAX_EVENT_IDS) {
    chunks.push(ids.slice(i, i + MAX_EVENT_IDS));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await client.events.$get({ query: { ids: chunk.join(",") } });
      if (res.status !== 200) {
        throw new Error(await readErrorMessage(res, "イベントの取得に失敗しました。"));
      }
      return await res.json();
    }),
  );
  return results.flat();
}
