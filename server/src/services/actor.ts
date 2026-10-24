import { eq, or } from "drizzle-orm";
import * as schema from "../db/schema.js";

/**
 * 操作する本人。ブラウザ (browserId) は常にあり、ログインしていれば userId もある。
 * 参加者 (participant) の持ち主は、ブラウザかユーザーのどちらか一方。
 * userId が一致するか、browserId が一致すれば本人のものとみなす。
 * (ログインすると、そのブラウザの参加者はユーザーのものになる。別の端末でログインすれば、同じ参加者を操作できる。
 * ユーザーの参加者はブラウザのものではないので、ログアウトしたり、同じブラウザで別の人がログインしたりしても触れない)
 */
export type Actor = { browserId: string; userId: string | null };

/** 新しく作る参加者の持ち主。ログインしていればユーザー、していなければブラウザ */
export function ownerOf(actor: Actor) {
  return actor.userId ? { browserId: null, userId: actor.userId } : { browserId: actor.browserId, userId: null };
}

/** 本人の参加者を探す条件 */
export function ownedBy(actor: Actor) {
  const byBrowser = eq(schema.participant.browserId, actor.browserId);
  return actor.userId ? or(eq(schema.participant.userId, actor.userId), byBrowser) : byBrowser;
}

/** 本人の参加者か (`ownedBy` と同じ条件) */
export function isMine(actor: Actor, participant: { browserId: string | null; userId: string | null }) {
  return (actor.userId !== null && participant.userId === actor.userId) || participant.browserId === actor.browserId;
}

/**
 * 本人の参加者のうち 1 人を選ぶ。1 つのイベントで、userId で一致する参加者 (別の端末で回答した) と、
 * browserId で一致する参加者 (紐づけなかった) の両方がありうるので、userId で一致する方を優先する。
 */
export function pickMine<T extends { browserId: string | null; userId: string | null }>(
  actor: Actor,
  participants: T[],
) {
  return (
    (actor.userId ? participants.find((p) => p.userId === actor.userId) : undefined) ??
    participants.find((p) => p.browserId === actor.browserId)
  );
}
