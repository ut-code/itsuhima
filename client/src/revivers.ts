// レスポンスの日付・日時の文字列を Dayjs に変換

import dayjs from "./lib/dayjs";
import type {
  BriefEvent,
  Event,
  ISOStringBriefEvent,
  ISOStringEvent,
  ISOStringParticipant,
  Participant,
  Slot,
} from "./types";

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
    participants: event.participants.map(participantReviver),
  };
}

export function participantReviver(participant: ISOStringParticipant): Participant {
  return {
    ...participant,
    comment: participant.comment ?? undefined,
    slots: participant.slots.map(slotReviver),
  };
}

function slotReviver({ startAt, endAt, optionId, ...slot }: ISOStringParticipant["slots"][number]): Slot {
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
 * @param isHost 作ったイベントか (localStorage の控えから)
 */
export function briefEventReviver(event: ISOStringBriefEvent, isHost: boolean): BriefEvent {
  return {
    ...event,
    startDate: dayjs.tz(event.startDate),
    endDate: dayjs.tz(event.endDate),
    isHost,
  };
}
