import dayjs, { APP_TIMEZONE } from "../lib/dayjs.js";
import type { ProjectWithRelations } from "./projects.js";

export type OptionBreakdown = { participationOptionId: string; label: string; guestNames: string[] };

export type AvailabilityInterval = {
  start: Date;
  end: Date;
  /** この区間に参加できるゲスト数 */
  count: number;
  guestNames: string[];
  byOption: OptionBreakdown[];
};

type GuestSlot = {
  guestId: string;
  guestName: string;
  from: number;
  to: number;
  participationOptionId: string;
};

/**
 * 全ゲストの Slot を掃引して「何人が参加できるか」が一定な区間に分割する。
 *
 * Slot は連続した時間範囲なので、境界点（各 Slot の from / to）で区切れば
 * 区間内の参加者集合は変化しない。区間ごとに集合を求め、隣接して同一集合なら結合する。
 */
export function computeAvailability(project: ProjectWithRelations): AvailabilityInterval[] {
  const optionLabels = new Map(project.participationOptions.map((o) => [o.id, o.label]));

  const slots: GuestSlot[] = project.guests.flatMap((guest) =>
    guest.slots.map((slot) => ({
      guestId: guest.id,
      guestName: guest.name,
      from: slot.from.getTime(),
      to: slot.to.getTime(),
      participationOptionId: slot.participationOptionId,
    })),
  );
  if (slots.length === 0) return [];

  const boundaries = [...new Set(slots.flatMap((s) => [s.from, s.to]))].sort((a, b) => a - b);

  type Segment = { start: number; end: number; members: Map<string, GuestSlot> };
  const segments: Segment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const members = new Map<string, GuestSlot>();
    for (const slot of slots) {
      // 半開区間 [from, to) として判定する
      if (slot.from <= start && slot.to >= end) {
        members.set(slot.guestId, slot);
      }
    }
    segments.push({ start, end, members });
  }

  // 隣接かつ参加者集合（と参加形態）が同一なら結合する。
  // 参加者ゼロの区間も一旦残しておくことで、日をまたぐ結合を防いでいる。
  const merged: Segment[] = [];
  for (const segment of segments) {
    const prev = merged.at(-1);
    if (prev && prev.end === segment.start && sameMembership(prev.members, segment.members)) {
      prev.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }

  return merged
    .filter((s) => s.members.size > 0)
    .map((s) => {
      const byOption = new Map<string, string[]>();
      for (const slot of s.members.values()) {
        const names = byOption.get(slot.participationOptionId) ?? [];
        names.push(slot.guestName);
        byOption.set(slot.participationOptionId, names);
      }
      return {
        start: new Date(s.start),
        end: new Date(s.end),
        count: s.members.size,
        guestNames: [...s.members.values()].map((m) => m.guestName),
        byOption: [...byOption.entries()].map(([participationOptionId, guestNames]) => ({
          participationOptionId,
          label: optionLabels.get(participationOptionId) ?? "不明",
          guestNames,
        })),
      };
    });
}

export type CommonAvailabilityOptions = {
  minDurationMinutes?: number;
  topN?: number;
};

/**
 * 参加人数の多い順に上位 N 件を返す。同数なら早い時間帯を優先する。
 */
export function findCommonAvailability(
  project: ProjectWithRelations,
  { minDurationMinutes = 30, topN = 10 }: CommonAvailabilityOptions = {},
): AvailabilityInterval[] {
  return computeAvailability(project)
    .filter((interval) => interval.end.getTime() - interval.start.getTime() >= minDurationMinutes * 60_000)
    .sort((a, b) => b.count - a.count || a.start.getTime() - b.start.getTime())
    .slice(0, topN);
}

/** LLM に読ませるための JST 表記 */
export function formatInterval(interval: AvailabilityInterval): string {
  const start = dayjs(interval.start).tz(APP_TIMEZONE);
  const end = dayjs(interval.end).tz(APP_TIMEZONE);
  return `${start.format("YYYY-MM-DD(ddd) HH:mm")}〜${end.format("HH:mm")}`;
}

/** 参加者集合と、各参加者の参加形態がまったく同じか */
function sameMembership(a: Map<string, GuestSlot>, b: Map<string, GuestSlot>): boolean {
  if (a.size !== b.size) return false;
  for (const [guestId, slot] of a) {
    const other = b.get(guestId);
    if (!other || other.participationOptionId !== slot.participationOptionId) return false;
  }
  return true;
}
