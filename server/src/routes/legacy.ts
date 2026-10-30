import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { readLegacyBrowserId } from "../lib/legacyBrowserId.js";
import { exchangeLegacyEvents } from "../services/legacy.js";

/** browserId をやめる前の一覧を、client の控えに移すための口 */
const router = new Hono<AppEnv>()
  // browserId の Cookie があれば、そのブラウザで作ったイベントと回答したイベントを返す。
  // Cookie は消さない (ロールバックしたときに、前のバージョンで本人の判定が戻るように)
  .post("/exchange", async (c) => {
    const browserId = await readLegacyBrowserId(c);
    const events = browserId === null ? [] : await exchangeLegacyEvents(c.get("db"), browserId);
    return c.json(events, 200);
  });

export default router;
