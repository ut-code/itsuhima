// レスポンスの ISO 8601 文字列を Date に変換
import type { BriefProject, ISOStringBriefProject, ISOStringProject, Project } from "./types";

/**
 * Project の日時のプロパティを ISO 文字列から Date オブジェクトに変換する
 * @param project
 * @returns
 */
export function projectReviver(project: ISOStringProject): Project {
  return {
    ...project,
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    allowedRanges: project.allowedRanges.map((range) => ({
      ...range,
      startTime: new Date(range.startTime),
      endTime: new Date(range.endTime),
    })),
    hosts: project.hosts.map((host) => ({ ...host })),
    guests: project.guests.map((guest) => ({
      ...guest,
      slots: guest.slots.map((slot) => ({
        ...slot,
        from: new Date(slot.from),
        to: new Date(slot.to),
      })),
    })),
    meAsGuest: project.meAsGuest
      ? {
          ...project.meAsGuest,
          slots: project.meAsGuest.slots.map((slot) => ({
            ...slot,
            from: new Date(slot.from),
            to: new Date(slot.to),
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
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
  };
}
