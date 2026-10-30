import type * as schema from "../db/schema.js";

/** 操作する人。今はブラウザ (browserId) で表す */
export type Actor = { browserId: string };

type Participant = typeof schema.participant.$inferSelect;

/** イベントの設定を変えたり、イベントを削除したりできるか。今はホストだけ */
export function canEditEvent(actor: Actor, event: { participants: Pick<Participant, "role" | "browserId">[] }) {
  return event.participants.some((p) => p.role === "host" && p.browserId === actor.browserId);
}

/** 回答を変えられるか。今は回答した本人 (同じブラウザ) だけ */
export function canEditParticipant(actor: Actor, participant: Pick<Participant, "browserId">) {
  return participant.browserId === actor.browserId;
}
