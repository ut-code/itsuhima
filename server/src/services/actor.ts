import { eq, or } from "drizzle-orm";
import * as schema from "../db/schema.js";

/**
 * 操作する本人。ブラウザ (browserId) は常にあり、ログインしていれば userId もある。
 * 参加者 (participant) は、userId が一致するか、browserId が一致すれば本人のものとみなす。
 * (ログインすると、そのブラウザの参加者に userId が付く。別の端末でログインすれば、同じ参加者を操作できる)
 */
export type Actor = { browserId: string; userId: string | null };

/** 本人の参加者を探す条件 */
export function ownedBy(actor: Actor) {
  const byBrowser = eq(schema.participant.browserId, actor.browserId);
  return actor.userId ? or(eq(schema.participant.userId, actor.userId), byBrowser) : byBrowser;
}

/**
 * 本人の参加者のうち 1 人を選ぶ。1 つのイベントで、userId で一致する参加者 (別の端末で回答した) と、
 * browserId で一致する参加者 (まだ紐づいていない) の両方がありうるので、userId で一致する方を優先する。
 */
export function pickMine<T extends { browserId: string; userId: string | null }>(actor: Actor, participants: T[]) {
  return (
    (actor.userId ? participants.find((p) => p.userId === actor.userId) : undefined) ??
    participants.find((p) => p.browserId === actor.browserId)
  );
}
