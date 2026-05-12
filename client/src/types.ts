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
  startTime: Dayjs;
  endTime: Dayjs;
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
  startDate: Dayjs;
  endDate: Dayjs;
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
  startDate: string;
  endDate: string;
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

export type BriefProject = Pick<Project, "id" | "name" | "startDate" | "endDate" | "isHost">;
export type ISOStringBriefProject = Pick<ISOStringProject, "id" | "name" | "startDate" | "endDate" | "isHost">;
