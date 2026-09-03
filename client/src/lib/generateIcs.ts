import { createEvents, type DateArray } from "ics";
import type { Dayjs } from "./dayjs";

type SlotForIcs = {
  from: Dayjs;
  to: Dayjs;
  label: string;
};

function toUtcDateArray(date: Dayjs): DateArray {
  const utcDate = date.utc();
  return [utcDate.year(), utcDate.month() + 1, utcDate.date(), utcDate.hour(), utcDate.minute()];
}

export function generateIcs(
  projectName: string,
  slots: SlotForIcs[],
  eventUrl?: string,
  projectDescription?: string,
): string {
  const description = [
    "イツヒマで提出した参加候補日程です。",
    eventUrl ? `イベントページ: ${eventUrl}` : null,
    projectDescription ? `\n${projectDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { error, value } = createEvents(
    slots.map((slot) => ({
      title: `【候補】${projectName}${slot.label ? `（${slot.label}）` : ""} - イツヒマ`,
      description,
      start: toUtcDateArray(slot.from),
      startInputType: "utc",
      end: toUtcDateArray(slot.to),
      endInputType: "utc",
    })),
  );

  if (error || !value) {
    throw error ?? new Error("ics の生成に失敗しました。");
  }

  return value;
}
