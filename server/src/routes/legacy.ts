import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { clearLegacyBrowserIdCookies, readLegacyBrowserId } from "../lib/legacyBrowserId.js";
import { exchangeLegacyEvents, forgetLegacyEvents } from "../services/legacy.js";

/** browserId をやめる前の一覧を、client の控えに移すための口 */
const router = new Hono<AppEnv>()
  // browserId の Cookie があれば、そのブラウザで作ったイベントと回答したイベントを返す。
  // Cookie は消さない (ロールバックしたときに、前のバージョンで本人の判定が戻るように)
  .post("/exchange", async (c) => {
    const browserId = await readLegacyBrowserId(c);
    const events = browserId === null ? [] : await exchangeLegacyEvents(c.get("db"), browserId);
    return c.json(events, 200);
  })
  // ゲストがこのブラウザの記録を削除したとき。前の一覧の行と、browserId の Cookie を消す (本人が選んだので、ロールバックに備えて残さない)
  .delete("/browser", async (c) => {
    const browserId = await readLegacyBrowserId(c);
    if (browserId !== null) await forgetLegacyEvents(c.get("db"), browserId);
    for (const value of clearLegacyBrowserIdCookies(c.env)) c.header("Set-Cookie", value, { append: true });
    return c.body(null, 204);
  });

export default router;
