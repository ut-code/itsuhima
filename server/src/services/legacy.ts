import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import * as schema from "../db/schema.js";

/**
 * browserId で作ったイベントと回答したイベントを返し、その行を消す (一度だけ交換できる)。
 * client は、これを localStorage の控えに足す。権限は戻さない。
 */
export async function exchangeLegacyEvents(db: Db, browserId: string) {
  const rows = await db
    .select({
      id: schema.legacyBrowserEvent.eventId,
      isHost: schema.legacyBrowserEvent.isHost,
      participantId: schema.legacyBrowserEvent.participantId,
    })
    .from(schema.legacyBrowserEvent)
    .where(eq(schema.legacyBrowserEvent.browserId, browserId));
  if (rows.length > 0) {
    await db.delete(schema.legacyBrowserEvent).where(eq(schema.legacyBrowserEvent.browserId, browserId));
  }
  return rows;
}
