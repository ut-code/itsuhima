import { and, eq, inArray, isNull } from "drizzle-orm";
import { type Db, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";

type BrowserAndUser = { browserId: string; userId: string };

/**
 * そのブラウザの、まだユーザーに紐づいていない参加者を、紐づけられるもの (targets) と、
 * 同じイベントにすでにそのユーザーの参加者 (別の端末で紐づけたもの) があって紐づけられないもの (conflicts) に分ける。
 */
async function partitionUnlinked(db: Db, { browserId, userId }: BrowserAndUser) {
  const unlinked = await db.query.participant.findMany({
    where: and(eq(schema.participant.browserId, browserId), isNull(schema.participant.userId)),
    columns: { id: true, eventId: true, role: true, name: true },
  });
  if (unlinked.length === 0) {
    return { targets: [], conflicts: [] };
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
  const conflictEventIds = new Set(alreadyLinked.map((p) => p.eventId));
  return {
    targets: unlinked.filter((p) => !conflictEventIds.has(p.eventId)),
    conflicts: unlinked.filter((p) => conflictEventIds.has(p.eventId)),
  };
}

/**
 * ログインしたときに、そのブラウザ (browserId) の参加者をユーザーに紐づける。
 * 以降は、別の端末でも同じユーザーとしてログインすれば、その参加者を操作できる。
 *
 * 同じイベントに、すでにそのユーザーの参加者 (別の端末で紐づけたもの) があるときは、紐づけない (何も消さない)。
 * 紐づけなかった参加者は、ログインしていればユーザーの参加者の方が「自分」になるので見えなくなる (`pickMine`)。
 * そのことは、ログインした後に client が `findLinkConflicts` で知らせる。
 *
 * @returns 紐づけた参加者の数と、ぶつかって紐づけなかったイベント
 */
export async function linkBrowserToUser(db: Db, actor: BrowserAndUser) {
  const { targets, conflicts } = await partitionUnlinked(db, actor);
  await runBatch(
    db,
    targets.map((p) =>
      db.update(schema.participant).set({ userId: actor.userId }).where(eq(schema.participant.id, p.id)),
    ),
  );
  return { linked: targets.length, conflictEventIds: conflicts.map((p) => p.eventId) };
}

/** ぶつかって紐づけなかった、このブラウザの参加者と、そのイベント。利用者に知らせるため */
export async function findLinkConflicts(db: Db, actor: BrowserAndUser) {
  const { conflicts } = await partitionUnlinked(db, actor);
  if (conflicts.length === 0) {
    return [];
  }

  const events = await db.query.event.findMany({
    where: inArray(
      schema.event.id,
      conflicts.map((p) => p.eventId),
    ),
    columns: { id: true, name: true },
  });
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  return conflicts.map((p) => ({
    eventId: p.eventId,
    eventName: eventName.get(p.eventId) ?? "",
    isHost: p.role === "host",
    /** このブラウザで回答したときの名前。回答していない (イベントを作っただけ) なら null */
    name: p.name,
  }));
}
