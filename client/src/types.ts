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
  participantId: string;
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

/** 回答。URL を知っている人は誰でも編集できる (canEdit) */
export type Participant = {
  id: string;
  name: string;
  eventId: string;
  comment?: string;
  slots: Slot[];
  canEdit: boolean;
};

export type Event = {
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
  options: ParticipationOption[];
  participants: Participant[];
  canEdit: boolean;
};

// TODO: ユーティリティ関数で処理するようにする
export type ISOStringEvent = {
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
  options: {
    id: string;
    label: string;
    color: string;
    eventId: string;
  }[];
  participants: ISOStringParticipant[];
  canEdit: boolean;
};

export type ISOStringParticipant = {
  id: string;
  name: string;
  eventId: string;
  comment: string | null;
  slots: {
    id: string;
    eventId: string;
    participantId: string;
    /** UTC の ISO 8601 */
    startAt: string;
    /** UTC の ISO 8601 */
    endAt: string;
    optionId: string;
  }[];
  canEdit: boolean;
};

/** ホームの一覧に出すイベント。isHost は localStorage の控えから付ける */
export type BriefEvent = Pick<Event, "id" | "name" | "startDate" | "endDate" | "timezone"> & {
  deleted: boolean;
  isHost: boolean;
};
export type ISOStringBriefEvent = Pick<ISOStringEvent, "id" | "name" | "startDate" | "endDate" | "timezone"> & {
  deleted: boolean;
};
