import { createDb } from "./db/index.js";
import type { Bindings } from "./env.js";
import { purgeDeletedEvents } from "./services/events.js";

/** Cron Trigger (wrangler.toml の `[triggers]`) で定期的に動く処理 */
export async function scheduled(_controller: ScheduledController, env: Bindings) {
  await purgeDeletedEvents(createDb(env.DB));
}
