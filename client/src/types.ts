import type { Dayjs } from "./lib/dayjs";

type ParticipationOption = {
  id: string;
  label: string;
  color: string;
  projectId: string;
};

export type Slot = {
  id: string;
  projectId: string;
  guestId: string;
  from: Dayjs;
  to: Dayjs;
  participationOptionId: string;
};

type AllowedRange = {
  id: string;
  projectId: string;
  /** イベントのタイムゾーンでの時刻 ("HH:mm") */
  startTime: string;
  /** イベントのタイムゾーンでの時刻 ("HH:mm")。その日の終わりまでなら "24:00" */
  endTime: string;
};

type Host = {
  id: string;
  projectId: string;
};

type Guest = {
  id: string;
  name: string;
  projectId: string;
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
    projectId: string;
    startTime: string;
    endTime: string;
  }[];
  participationOptions: {
    id: string;
    label: string;
    color: string;
    projectId: string;
  }[];
  hosts: Host[];
  guests: {
    id: string;
    name: string;
    projectId: string;
    comment: string | null;
    slots: {
      id: string;
      projectId: string;
      guestId: string;
      from: string;
      to: string;
      participationOptionId: string;
    }[];
  }[];
  isHost: boolean;
  meAsGuest: {
    id: string;
    name: string;
    projectId: string;
    comment: string | null;
    slots: {
      id: string;
      projectId: string;
      guestId: string;
      from: string;
      to: string;
      participationOptionId: string;
    }[];
  } | null;
};

export type BriefProject = Pick<Project, "id" | "name" | "startDate" | "endDate" | "timezone" | "isHost">;
export type ISOStringBriefProject = Pick<
  ISOStringProject,
  "id" | "name" | "startDate" | "endDate" | "timezone" | "isHost"
>;
