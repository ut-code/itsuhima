export type Slot = {
  id: string;
  projectId: string;
  guestId: string;
  from: Date;
  to: Date;
};

type AllowedRange = {
  id: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
};

type Host = {
  id: string;
  projectId: string;
};

type Guest = {
  id: string;
  name: string;
  projectId: string;
  slots: Slot[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  allowedRanges: AllowedRange[];
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
  hosts: Host[];
  guests: {
    id: string;
    name: string;
    projectId: string;
    slots: {
      id: string;
      projectId: string;
      guestId: string;
      from: string;
      to: string;
    }[];
  }[];
  isHost: boolean;
  meAsGuest: {
    id: string;
    name: string;
    projectId: string;
    slots: {
      id: string;
      projectId: string;
      guestId: string;
      from: string;
      to: string;
    }[];
  } | null;
};

export type BriefProject = Pick<Project, "id" | "name" | "startDate" | "endDate" | "isHost">;
export type ISOStringBriefProject = Pick<ISOStringProject, "id" | "name" | "startDate" | "endDate" | "isHost">;
