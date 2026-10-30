import type { Db } from "../db/index.js";
import * as schema from "../db/schema.js";

/** 履歴に残す、イベントの設定。形はイベントの編集の入力 (`editEventReqSchema`) と同じで、そのまま戻せる */
export type EventSnapshot = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  allowedRanges: { startTime: string; endTime: string }[];
  options: { id: string; label: string; color: string }[];
};

/** 履歴に残す、回答。Slot の日時は UTC の ISO 8601 */
export type ParticipantSnapshot = {
  name: string;
  comment: string | null;
  slots: { startAt: string; endAt: string; optionId: string }[];
};

export type HistoryBefore =
  | { target: "event"; before: EventSnapshot }
  | { target: "participant"; before: ParticipantSnapshot };

export function eventSnapshot(event: {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allowedRanges: { startTime: string; endTime: string }[];
  options: { id: string; label: string; color: string }[];
}): EventSnapshot {
  return {
    name: event.name,
    description: event.description ?? "",
    startDate: event.startDate,
    endDate: event.endDate,
    allowedRanges: event.allowedRanges.map(({ startTime, endTime }) => ({ startTime, endTime })),
    options: event.options.map(({ id, label, color }) => ({ id, label, color })),
  };
}

export function participantSnapshot(participant: {
  name: string;
  comment: string | null;
  slots: { startAt: string; endAt: string; optionId: string }[];
}): ParticipantSnapshot {
  return {
    name: participant.name,
    comment: participant.comment,
    slots: participant.slots.map(({ startAt, endAt, optionId }) => ({ startAt, endAt, optionId })),
  };
}

/** 並び順の違いを無視して、同じ内容か */
export function isSameSnapshot<T extends EventSnapshot | ParticipantSnapshot>(a: T, b: T) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(snapshot: EventSnapshot | ParticipantSnapshot) {
  const sortByJson = <U>(items: U[]) => items.map((item) => JSON.stringify(item)).sort();
  if ("slots" in snapshot) {
    return { ...snapshot, slots: sortByJson(snapshot.slots) };
  }
  return { ...snapshot, allowedRanges: sortByJson(snapshot.allowedRanges), options: sortByJson(snapshot.options) };
}

/** 変える前のスナップショットを履歴に足す文。変える文と同じ batch で実行する */
export function insertHistory(
  db: Db,
  history: HistoryBefore & { eventId: string; targetId: string; action: "update" | "delete" },
) {
  return db.insert(schema.history).values(history);
}
