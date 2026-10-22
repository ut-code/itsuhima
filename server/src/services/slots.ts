import { ServiceError } from "./errors.js";

const MINUTES_PER_DAY = 24 * 60;

/** timezone での日付 ("YYYY-MM-DD") と、0 時からの経過分を求める関数を作る */
function wallClockIn(timezone: string): (value: Date) => { date: string; minutes: number } {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (value) => {
    const parts = Object.fromEntries(format.formatToParts(value).map((p) => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  };
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 秒以下が 0 で、分が 15 の倍数か。タイムゾーンのオフセットはどれも 15 分の倍数なので UTC で判定してよい。 */
function isQuarterHour(value: Date): boolean {
  return value.getTime() % (15 * 60 * 1000) === 0;
}

type SlotInput = { start: Date; end: Date; participationOptionId: string };

type Project = {
  /** 日付と時間帯は、このタイムゾーンの壁時計で解釈する (AllowedRange は日付部分を使わず、時刻だけを使う) */
  timezone: string;
  startDate: Date;
  endDate: Date;
  allowedRanges: { startTime: Date; endTime: Date }[];
  participationOptions: { id: string }[];
};

/**
 * Slot がイベントの日程の範囲・時間帯・15 分単位に収まり、イベントの参加形態を使っているかを検証する。
 * Web UI はカレンダーの構造上これを満たすが、API を直接呼ぶと満たさない Slot を作れてしまう (#91)。
 */
export function validateSlots(project: Project, slots: SlotInput[]): void {
  const toWallClock = wallClockIn(project.timezone);
  const firstDate = toWallClock(project.startDate).date;
  const lastDate = toWallClock(project.endDate).date;
  // 時間帯は現在 1 つだけ。無ければ終日とみなす
  const range = project.allowedRanges[0];
  const rangeStart = range ? toWallClock(range.startTime).minutes : 0;
  const rangeEnd = range ? toWallClock(range.endTime).minutes : MINUTES_PER_DAY;
  const optionIds = new Set(project.participationOptions.map((o) => o.id));

  slots.forEach((slot, i) => {
    const invalid = (message: string) => new ServiceError("invalid_slot", `${i + 1} 件目の時間帯: ${message}`);

    if (slot.start.getTime() >= slot.end.getTime()) {
      throw invalid("開始時刻は終了時刻より前にしてください。");
    }
    if (!isQuarterHour(slot.start) || !isQuarterHour(slot.end)) {
      throw invalid("時刻は 15 分単位で指定してください。");
    }

    const start = toWallClock(slot.start);
    const end = toWallClock(slot.end);
    // [start, end) の最後の瞬間の日付。24:00 は翌日の 0:00 として届くので、こうしないと日をまたいだことになる
    const lastInstantDate = toWallClock(new Date(slot.end.getTime() - 1)).date;
    if (lastInstantDate !== start.date) {
      throw invalid("日をまたいでいます。日付ごとに分けてください。");
    }
    if (start.date < firstDate || start.date > lastDate) {
      throw invalid(`イベントの日程の範囲 (${firstDate}〜${lastDate}) の外です。`);
    }
    const endMinutes = end.date === start.date ? end.minutes : MINUTES_PER_DAY;
    if (start.minutes < rangeStart || endMinutes > rangeEnd) {
      throw invalid(`イベントの時間帯 (${formatMinutes(rangeStart)}〜${formatMinutes(rangeEnd)}) の外です。`);
    }

    if (!optionIds.has(slot.participationOptionId)) {
      throw invalid("このイベントに無い参加形態です。");
    }
  });
}
