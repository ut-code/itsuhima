import { and, eq, inArray, isNull } from "drizzle-orm";
import { type Db, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";

/**
 * ログインしたときに、そのブラウザ (browserId) の参加者をユーザーに紐づける。
 * 以降は、別の端末でも同じユーザーとしてログインすれば、その参加者を操作できる。
 *
 * 同じイベントに、すでにそのユーザーの参加者 (別の端末で紐づけたもの) があるときは、紐づけない (何も消さない)。
 * どちらを残すか (ホストを優先する、新しい方を残す など) と、利用者への知らせ方は未決。
 * 紐づけなかった参加者も、このブラウザからは今までどおり操作できる。
 *
 * @returns 紐づけた参加者の数と、ぶつかって紐づけなかったイベント
 */
export async function linkBrowserToUser(db: Db, { browserId, userId }: { browserId: string; userId: string }) {
  const unlinked = await db.query.participant.findMany({
    where: and(eq(schema.participant.browserId, browserId), isNull(schema.participant.userId)),
    columns: { id: true, eventId: true },
  });
  if (unlinked.length === 0) {
    return { linked: 0, conflictEventIds: [] };
  }

  const alreadyLinked = await db.query.participant.findMany({
    where: and(
      eq(schema.participant.userId, userId),
      inArray(
        schema.participant.eventId,
        unlinked.map((p) => p.eventId),
      ),
    ),
    columns: { eventId: true },
  });
  const conflictEventIds = alreadyLinked.map((p) => p.eventId);
  const targets = unlinked.filter((p) => !conflictEventIds.includes(p.eventId));

  await runBatch(
    db,
    targets.map((p) => db.update(schema.participant).set({ userId }).where(eq(schema.participant.id, p.id))),
  );
  return { linked: targets.length, conflictEventIds };
}
