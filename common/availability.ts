import { wallClockIn } from "./wallClock.js";

/** 集計の対象にする参加者 (回答した参加者) と、その Slot */
export type AvailabilityParticipant = {
  id: string;
  name: string;
  /** startAt / endAt は ISO 8601 */
  slots: { startAt: string; endAt: string; optionId: string }[];
};

/** ある区間に参加できる参加者と、その参加形態 */
export type AvailabilityMember = {
  participantId: string;
  name: string;
  optionId: string;
};

/** 参加できる参加者 (と参加形態) が変わらない区間 */
export type AvailabilityInterval = {
  /** UTC の ISO 8601 */
  startAt: string;
  /** UTC の ISO 8601 */
  endAt: string;
  /** イベントのタイムゾーンでの日付 ("YYYY-MM-DD") */
  date: string;
  members: AvailabilityMember[];
};

type Segment = { start: number; end: number; date: string; members: Map<string, AvailabilityMember> };

/**
 * 全参加者の Slot を、参加できる参加者 (と参加形態) が変わらない区間に分ける。時刻の順に返し、誰もいない区間は含めない。
 *
 * Slot の端 (startAt / endAt) で区切れば、区切った区間の中では参加者は変わらない。区切った区間ごとに参加者を求め、
 * 隣り合っていて参加者が同じなら 1 つにまとめる。Slot は日をまたがないので、日付が変わるところではまとめない
 * (同じ人が 23:00〜24:00 と翌日の 0:00〜1:00 に参加できても、別の区間にする)。
 */
export function summarizeAvailability(
  event: { timezone: string },
  participants: AvailabilityParticipant[],
): AvailabilityInterval[] {
  const toWallClock = wallClockIn(event.timezone);
  const slots = participants.flatMap((p) =>
    p.slots.map((slot) => ({
      participantId: p.id,
      name: p.name,
      optionId: slot.optionId,
      start: Date.parse(slot.startAt),
      end: Date.parse(slot.endAt),
    })),
  );
  if (slots.length === 0) return [];

  const boundaries = [...new Set(slots.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);

  const merged: Segment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const members = new Map<string, AvailabilityMember>();
    for (const slot of slots) {
      // [start, end) の半開区間として、区切った区間を覆う Slot を探す
      if (slot.start <= start && end <= slot.end) {
        members.set(slot.participantId, {
          participantId: slot.participantId,
          name: slot.name,
          optionId: slot.optionId,
        });
      }
    }
    if (members.size === 0) continue;

    const date = toWallClock(new Date(start)).date;
    const prev = merged[merged.length - 1];
    if (prev && prev.end === start && prev.date === date && sameMembers(prev.members, members)) {
      prev.end = end;
      continue;
    }
    merged.push({ start, end, date, members });
  }

  return merged.map((s) => ({
    startAt: new Date(s.start).toISOString(),
    endAt: new Date(s.end).toISOString(),
    date: s.date,
    members: [...s.members.values()],
  }));
}

export type FindCandidatesOptions = {
  /** この分数以上続く区間だけを候補にする */
  minDurationMinutes?: number;
  /** この人数以上が参加できる区間だけを候補にする */
  minPeople?: number;
  /** 返す件数の上限 */
  limit?: number;
};

/**
 * 参加できる人数の多い区間を、多い順に返す。同じ人数なら早い区間を先にする。
 * (Web の「最多人数」のハイライトは、このうち人数が最多のものにあたる)
 */
export function findCandidates(
  intervals: AvailabilityInterval[],
  { minDurationMinutes = 30, minPeople = 1, limit = 10 }: FindCandidatesOptions = {},
): AvailabilityInterval[] {
  return intervals
    .filter((interval) => durationMinutes(interval) >= minDurationMinutes && interval.members.length >= minPeople)
    .sort((a, b) => b.members.length - a.members.length || Date.parse(a.startAt) - Date.parse(b.startAt))
    .slice(0, limit);
}

/** 区間の長さ (分) */
export function durationMinutes(interval: { startAt: string; endAt: string }): number {
  return (Date.parse(interval.endAt) - Date.parse(interval.startAt)) / 60_000;
}

/** 参加者と、各参加者の参加形態がまったく同じか */
function sameMembers(a: Map<string, AvailabilityMember>, b: Map<string, AvailabilityMember>): boolean {
  if (a.size !== b.size) return false;
  for (const [participantId, member] of a) {
    if (b.get(participantId)?.optionId !== member.optionId) return false;
  }
  return true;
}
