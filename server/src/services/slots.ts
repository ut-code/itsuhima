import { formatMinutes, parseMinutes, wallClockIn } from "../lib/wallClock.js";
import { ServiceError } from "./errors.js";

const MINUTES_PER_DAY = 24 * 60;

/** 秒以下が 0 で、分が 15 の倍数か。タイムゾーンのオフセットはどれも 15 分の倍数なので UTC で判定してよい。 */
function isQuarterHour(value: Date): boolean {
  return value.getTime() % (15 * 60 * 1000) === 0;
}

type SlotInput = { startAt: Date; endAt: Date; optionId: string };

type EventForSlots = {
  /** 日付と時間帯は、このタイムゾーンの壁時計で解釈する */
  timezone: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD"。この日を含む */
  endDate: string;
  /** 時刻は "HH:mm" */
  allowedRanges: { startTime: string; endTime: string }[];
  options: { id: string }[];
};

/**
 * Slot がイベントの日程の範囲・時間帯・15 分単位に収まり、イベントの参加形態を使っているかを検証する。
 * Web UI はカレンダーの構造上これを満たすが、API を直接呼ぶと満たさない Slot を作れてしまう (#91)。
 */
export function validateSlots(event: EventForSlots, slots: SlotInput[]): void {
  const toWallClock = wallClockIn(event.timezone);
  // 時間帯は現在 1 つだけ。無ければ終日とみなす
  const range = event.allowedRanges[0];
  const rangeStart = range ? parseMinutes(range.startTime) : 0;
  const rangeEnd = range ? parseMinutes(range.endTime) : MINUTES_PER_DAY;
  const optionIds = new Set(event.options.map((o) => o.id));

  slots.forEach((slot, i) => {
    const invalid = (message: string) => new ServiceError("invalid_slot", `${i + 1} 件目の時間帯: ${message}`);

    if (slot.startAt.getTime() >= slot.endAt.getTime()) {
      throw invalid("開始時刻は終了時刻より前にしてください。");
    }
    if (!isQuarterHour(slot.startAt) || !isQuarterHour(slot.endAt)) {
      throw invalid("時刻は 15 分単位で指定してください。");
    }

    const start = toWallClock(slot.startAt);
    const end = toWallClock(slot.endAt);
    // [start, end) の最後の瞬間の日付。24:00 は翌日の 0:00 として届くので、こうしないと日をまたいだことになる
    const lastInstantDate = toWallClock(new Date(slot.endAt.getTime() - 1)).date;
    if (lastInstantDate !== start.date) {
      throw invalid("日をまたいでいます。日付ごとに分けてください。");
    }
    if (start.date < event.startDate || start.date > event.endDate) {
      throw invalid(`イベントの日程の範囲 (${event.startDate}〜${event.endDate}) の外です。`);
    }
    const endMinutes = end.date === start.date ? end.minutes : MINUTES_PER_DAY;
    if (start.minutes < rangeStart || endMinutes > rangeEnd) {
      throw invalid(`イベントの時間帯 (${formatMinutes(rangeStart)}〜${formatMinutes(rangeEnd)}) の外です。`);
    }

    if (!optionIds.has(slot.optionId)) {
      throw invalid("このイベントに無い参加形態です。");
    }
  });
}
