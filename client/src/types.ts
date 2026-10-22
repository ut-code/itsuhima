import type { Dayjs } from "./lib/dayjs";

type ParticipationOption = {
  id: string;
  label: string;
  color: string;
  eventId: string;
};

/** API の startAt / endAt / optionId を、カレンダーで使う名前にしたもの */
export type Slot = {
  id: string;
  eventId: string;
  guestId: string;
  from: Dayjs;
  to: Dayjs;
  participationOptionId: string;
};

type AllowedRange = {
  id: string;
  eventId: string;
  /** イベントのタイムゾーンでの時刻 ("HH:mm") */
  startTime: string;
  /** イベントのタイムゾーンでの時刻 ("HH:mm")。その日の終わりまでなら "24:00" */
  endTime: string;
};

type Host = {
  id: string;
  eventId: string;
};

type Guest = {
  id: string;
  name: string;
  eventId: string;
  comment?: string;
  slots: Slot[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  /** その日の 0:00 (イベントのタイムゾーン) */
  startDate: Dayjs;
  /** その日の 0:00 (イベントのタイムゾーン)。この日を含む */
  endDate: Dayjs;
  /** IANA のタイムゾーン名 */
  timezone: string;
  allowedRanges: AllowedRange[];
  participationOptions: ParticipationOption[];
  hosts: Host[];
  guests: Guest[];
  isHost: boolean;
  meAsGuest: Guest | null;
};

// TODO: ユーティリティ関数で処理するようにする
export type ISOStringProject = {
  id: string;
  name: string;
  description: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
  timezone: string;
  allowedRanges: {
    id: string;
    eventId: string;
    startTime: string;
    endTime: string;
  }[];
  participationOptions: {
    id: string;
    label: string;
    color: string;
    eventId: string;
  }[];
  hosts: Host[];
  guests: {
    id: string;
    name: string;
    eventId: string;
    comment: string | null;
    slots: {
      id: string;
      eventId: string;
      guestId: string;
      /** UTC の ISO 8601 */
      startAt: string;
      /** UTC の ISO 8601 */
      endAt: string;
      optionId: string;
    }[];
  }[];
  isHost: boolean;
  meAsGuest: {
    id: string;
    name: string;
    eventId: string;
    comment: string | null;
    slots: {
      id: string;
      eventId: string;
      guestId: string;
      /** UTC の ISO 8601 */
      startAt: string;
      /** UTC の ISO 8601 */
      endAt: string;
      optionId: string;
    }[];
  } | null;
};

export type BriefProject = Pick<Project, "id" | "name" | "startDate" | "endDate" | "timezone" | "isHost">;
export type ISOStringBriefProject = Pick<
  ISOStringProject,
  "id" | "name" | "startDate" | "endDate" | "timezone" | "isHost"
>;
