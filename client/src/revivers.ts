// レスポンスの日付・日時の文字列を Dayjs に変換

import dayjs from "./lib/dayjs";
import type { BriefEvent, Event, ISOStringBriefEvent, ISOStringEvent, Slot } from "./types";

/**
 * Event の日時のプロパティを ISO 文字列から Date オブジェクトに変換する
 * @param event
 * @returns
 */
export function eventReviver(event: ISOStringEvent): Event {
  return {
    ...event,
    startDate: dayjs.tz(event.startDate),
    endDate: dayjs.tz(event.endDate),
    allowedRanges: event.allowedRanges.map((range) => ({ ...range })),
    options: event.options.map((opt) => ({ ...opt })),
    hosts: event.hosts.map((host) => ({ ...host })),
    guests: event.guests.map((guest) => ({
      ...guest,
      comment: guest.comment ?? undefined,
      slots: guest.slots.map(slotReviver),
    })),
    meAsGuest: event.meAsGuest
      ? {
          ...event.meAsGuest,
          comment: event.meAsGuest.comment ?? undefined,
          slots: event.meAsGuest.slots.map(slotReviver),
        }
      : null,
  };
}

function slotReviver({ startAt, endAt, optionId, ...slot }: ISOStringEvent["guests"][number]["slots"][number]): Slot {
  return {
    ...slot,
    from: dayjs.utc(startAt).tz(),
    to: dayjs.utc(endAt).tz(),
    participationOptionId: optionId,
  };
}

/**
 * BriefEvent の日時のプロパティを ISO 文字列から Date オブジェクトに変換する
 * @param event
 * @returns
 */
export function briefEventReviver(event: ISOStringBriefEvent): BriefEvent {
  return {
    ...event,
    startDate: dayjs.tz(event.startDate),
    endDate: dayjs.tz(event.endDate),
  };
}
