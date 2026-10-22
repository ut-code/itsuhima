// レスポンスの日付・日時の文字列を Dayjs に変換

import dayjs from "./lib/dayjs";
import type { BriefProject, ISOStringBriefProject, ISOStringProject, Project, Slot } from "./types";

/**
 * Project の日時のプロパティを ISO 文字列から Date オブジェクトに変換する
 * @param project
 * @returns
 */
export function projectReviver(project: ISOStringProject): Project {
  return {
    ...project,
    startDate: dayjs.tz(project.startDate),
    endDate: dayjs.tz(project.endDate),
    allowedRanges: project.allowedRanges.map((range) => ({ ...range })),
    participationOptions: project.participationOptions.map((opt) => ({ ...opt })),
    hosts: project.hosts.map((host) => ({ ...host })),
    guests: project.guests.map((guest) => ({
      ...guest,
      comment: guest.comment ?? undefined,
      slots: guest.slots.map(slotReviver),
    })),
    meAsGuest: project.meAsGuest
      ? {
          ...project.meAsGuest,
          comment: project.meAsGuest.comment ?? undefined,
          slots: project.meAsGuest.slots.map(slotReviver),
        }
      : null,
  };
}

function slotReviver({ startAt, endAt, optionId, ...slot }: ISOStringProject["guests"][number]["slots"][number]): Slot {
  return {
    ...slot,
    from: dayjs.utc(startAt).tz(),
    to: dayjs.utc(endAt).tz(),
    participationOptionId: optionId,
  };
}

/**
 * BriefProject の日時のプロパティを ISO 文字列から Date オブジェクトに変換する
 * @param project
 * @returns
 */
export function briefProjectReviver(project: ISOStringBriefProject): BriefProject {
  return {
    ...project,
    startDate: dayjs.tz(project.startDate),
    endDate: dayjs.tz(project.endDate),
  };
}
