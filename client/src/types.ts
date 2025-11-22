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
  from: Date;
  to: Date;
  participationOptionId: string;
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
