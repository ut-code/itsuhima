import { z } from "zod";

const isoStrToDate = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

export const participationOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// 作成時（id はフロントエンドで UUID を生成）
export const participationOptionCreateSchema = z.object({
  id: z.string().uuid(), // フロントエンドで生成
  label: z.string().min(1, "ラベルを入力してください").max(50, "ラベルは50文字以内で入力してください"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "無効なカラーコードです"),
});

export const submitReqSchema = z.object({
  name: z.string(),
  projectId: z.string().length(21),
  slots: z.array(
    z.object({
      start: isoStrToDate,
      end: isoStrToDate,
      participationOptionId: z.string().uuid(),
    }),
  ),
});

const isQuarterHour = (time: string): boolean => {
  const [, minute] = time.split(":").map(Number);
  return [0, 15, 30, 45].includes(minute);
};

const baseProjectReqSchema = z.object({
  name: z.string().min(1, "イベント名を入力してください"),
  description: z.string(),
  startDate: z.string().min(1, "開始日を入力してください"),
  // TODO: 新規作成時のみ、過去日付を制限する必要
  // .refine(
  //   (startDate) => {
  //     const inputDate = new Date(startDate);
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     return inputDate >= today;
  //   },
  //   {
  //     message: "過去の日付は指定できません",
  //   },
  // ),
  endDate: z.string().min(1, "終了日を入力してください"),
  allowedRanges: z
    .array(
      z.object({
        startTime: z.string(),
        endTime: z.string(),
      }),
    )
    .refine((ranges) => ranges.every(({ startTime, endTime }) => startTime < endTime), {
      message: "開始時刻は終了時刻より前でなければなりません",
    })
    .refine((ranges) => ranges.every(({ startTime, endTime }) => isQuarterHour(startTime) && isQuarterHour(endTime)), {
      message: "開始時刻と終了時刻は15分単位で入力してください",
    }),
  participationOptions: z.array(participationOptionCreateSchema).min(1, "参加形態は最低1つ必要です"),
});

export const projectReqSchema = baseProjectReqSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: "開始日は終了日より前に設定してください",
    path: ["endDate"],
  },
);

export const editReqSchema = baseProjectReqSchema.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: "開始日は終了日より前に設定してください",
    path: ["endDate"],
  },
);
