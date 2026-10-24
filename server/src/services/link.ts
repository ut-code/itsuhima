import { and, eq, inArray } from "drizzle-orm";
import { type Db, runBatch } from "../db/index.js";
import * as schema from "../db/schema.js";

type BrowserAndUser = { browserId: string; userId: string };

type ParticipantSummary = {
  id: string;
  eventId: string;
  role: "host" | "guest";
  name: string | null;
  comment: string | null;
};

/**
 * 同じイベントの、このブラウザの参加者 (browser) とユーザーの参加者 (user) を 1 人にまとめる方法。まとめられなければ null。
 * 片方がまだ回答していない (イベントを作っただけのホスト) なら、ホストの行を残し、もう片方の回答をそこへ移す。
 * 両方とも回答していれば、どちらを残すかを決められないので、まとめない。
 */
function planMerge(browser: ParticipantSummary, user: ParticipantSummary) {
  if (browser.name === null && user.name !== null) return { keep: browser, drop: user };
  if (user.name === null && browser.name !== null) return { keep: user, drop: browser };
  return null;
}

/**
 * そのブラウザの参加者 (まだユーザーに紐づいていない) を、次の 3 つに分ける。
 * - targets: そのまま紐づけられるもの
 * - merges: 同じイベントにすでにそのユーザーの参加者 (ログインして作ったもの、別の端末で紐づけたもの) があり、1 人にまとめられるもの
 * - conflicts: 同じイベントにそのユーザーの参加者があり、まとめられないもの (両方とも回答している)
 */
async function partitionUnlinked(db: Db, { browserId, userId }: BrowserAndUser) {
  const columns = { id: true, eventId: true, role: true, name: true, comment: true } as const;
  const unlinked = await db.query.participant.findMany({
    where: eq(schema.participant.browserId, browserId),
    columns,
  });
  if (unlinked.length === 0) {
    return { targets: [], merges: [], conflicts: [] };
  }

  const alreadyLinked = await db.query.participant.findMany({
    where: and(
      eq(schema.participant.userId, userId),
      inArray(
        schema.participant.eventId,
        unlinked.map((p) => p.eventId),
      ),
    ),
    columns,
  });
  const linkedByEvent = new Map(alreadyLinked.map((p) => [p.eventId, p]));

  const targets: ParticipantSummary[] = [];
  const merges: { keep: ParticipantSummary; drop: ParticipantSummary }[] = [];
  const conflicts: ParticipantSummary[] = [];
  for (const p of unlinked) {
    const linked = linkedByEvent.get(p.eventId);
    if (!linked) {
      targets.push(p);
      continue;
    }
    const merge = planMerge(p, linked);
    if (merge) merges.push(merge);
    else conflicts.push(p);
  }
  return { targets, merges, conflicts };
}

/**
 * ログインしたときに、そのブラウザ (browserId) の参加者をユーザーに紐づける。
 * 紐づけた参加者は、ブラウザのものではなくユーザーのものになる (browserId を null にする)。
 * 以降は、別の端末でも同じユーザーとしてログインすれば、その参加者を操作でき、
 * ログアウトすると、このブラウザからは操作できない。
 *
 * 同じイベントに、すでにそのユーザーの参加者 (ログインして作ったもの、別の端末で紐づけたもの) があるときは、
 * - 片方がまだ回答していない (イベントを作っただけのホスト) なら、ホストの行に回答を移して 1 人にまとめる。
 * - 両方とも回答していれば、紐づけない (何も消さない)。紐づけなかった参加者はブラウザのものとして残り、
 *   ログアウトすれば操作できる。ログインしていれば、ユーザーの参加者の方が「自分」になるので見えなくなる
 *   (`pickMine`)。そのことは、ログインした後に client が `findLinkConflicts` で知らせる。
 *
 * @returns 紐づけた参加者の数、まとめた参加者の数、ぶつかって紐づけなかったイベント
 */
export async function linkBrowserToUser(db: Db, actor: BrowserAndUser) {
  const { targets, merges, conflicts } = await partitionUnlinked(db, actor);
  await runBatch(db, [
    ...targets.map((p) =>
      db
        .update(schema.participant)
        .set({ browserId: null, userId: actor.userId })
        .where(eq(schema.participant.id, p.id)),
    ),
    ...merges.flatMap(({ keep, drop }) => [
      // 消す前に予定を移す (消すと予定も CASCADE で消える)
      db
        .update(schema.slot)
        .set({ participantId: keep.id })
        .where(eq(schema.slot.participantId, drop.id)),
      // (eventId, browserId) と (eventId, userId) は一意なので、消す行を先に消してから、残す行にユーザーを付ける
      db
        .delete(schema.participant)
        .where(eq(schema.participant.id, drop.id)),
      db
        .update(schema.participant)
        .set({ browserId: null, userId: actor.userId, name: drop.name, comment: drop.comment })
        .where(eq(schema.participant.id, keep.id)),
    ]),
  ]);
  return { linked: targets.length, merged: merges.length, conflictEventIds: conflicts.map((p) => p.eventId) };
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
  // conflicts は両方とも回答しているものなので、name は null にならない。型を絞るために除く
  return conflicts.flatMap((p) =>
    p.name === null
      ? []
      : [
          {
            eventId: p.eventId,
            eventName: eventName.get(p.eventId) ?? "",
            isHost: p.role === "host",
            /** このブラウザで回答したときの名前 */
            name: p.name,
          },
        ],
  );
}
