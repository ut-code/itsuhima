// レスポンスの ISO 8601 文字列を Date に変換

import dayjs from "./lib/dayjs";
import type { BriefProject, ISOStringBriefProject, ISOStringProject, Project } from "./types";

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
    allowedRanges: project.allowedRanges.map((range) => ({
      ...range,
      startTime: dayjs.tz(range.startTime),
      endTime: dayjs.tz(range.endTime),
    })),
    participationOptions: project.participationOptions.map((opt) => ({ ...opt })),
    hosts: project.hosts.map((host) => ({ ...host })),
    guests: project.guests.map((guest) => ({
      ...guest,
      slots: guest.slots.map((slot) => ({
        ...slot,
        from: dayjs.tz(slot.from),
        to: dayjs.tz(slot.to),
      })),
    })),
    meAsGuest: project.meAsGuest
      ? {
          ...project.meAsGuest,
          slots: project.meAsGuest.slots.map((slot) => ({
            ...slot,
            from: dayjs.tz(slot.from),
            to: dayjs.tz(slot.to),
          })),
        }
      : null,
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
