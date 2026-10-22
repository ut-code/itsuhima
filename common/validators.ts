import { z } from "zod";

const isoStrToDate = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

export const optionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// 作成時（id はフロントエンドで UUID を生成）
export const optionCreateSchema = z.object({
  id: z.string().uuid(), // フロントエンドで生成
  label: z.string().min(1, "ラベルを入力してください").max(50, "ラベルは50文字以内で入力してください"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "無効なカラーコードです"),
});

export const submitReqSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(50, "名前は50文字以内で入力してください"),
  comment: z.string().max(500, "コメントは500文字以内で入力してください").nullable().optional(),
  slots: z.array(
    z.object({
      startAt: isoStrToDate,
      endAt: isoStrToDate,
      optionId: z.string().uuid(),
    }),
  ),
});

/** 時間帯の開始時刻 ("HH:mm") */
const startTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻の形式が正しくありません");

/** 時間帯の終了時刻 ("HH:mm")。その日の終わりまでを表す "24:00" も許す */
const endTime = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "時刻の形式が正しくありません");

/** "HH:mm" の分が 15 の倍数か */
const isQuarterHour = (time: string): boolean => {
  const [, minute] = time.split(":").map(Number);
  return [0, 15, 30, 45].includes(minute);
};

/**
 * イベントの作成・編集の入力。Web UI のフォームと API で共通。
 * 日程は "YYYY-MM-DD"、時間帯は "HH:mm" で、どちらもイベントのタイムゾーンの壁時計で解釈する。
 */
const baseEventSchema = z.object({
  name: z.string().min(1, "イベント名を入力してください").max(100, "イベント名は100文字以内で入力してください"),
  description: z.string().max(1000, "説明は1000文字以内で入力してください"),
  startDate: z.string().min(1, "開始日を入力してください").date("開始日の形式が正しくありません"),
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
  endDate: z.string().min(1, "終了日を入力してください").date("終了日の形式が正しくありません"),
  allowedRanges: z
    .array(
      z.object({
        startTime,
        endTime,
      }),
    )
    .refine((ranges) => ranges.every(({ startTime, endTime }) => startTime < endTime), {
      message: "開始時刻は終了時刻より前でなければなりません",
    })
    .refine((ranges) => ranges.every(({ startTime, endTime }) => isQuarterHour(startTime) && isQuarterHour(endTime)), {
      message: "開始時刻と終了時刻は15分単位で入力してください",
    }),
  options: z.array(optionCreateSchema).min(1, "参加形態は最低1つ必要です"),
});

const isDateOrdered = (data: { startDate?: string; endDate?: string }) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
};

const dateOrderError = {
  message: "開始日は終了日より前に設定してください",
  path: ["endDate"],
};

export const eventReqSchema = baseEventSchema.refine(isDateOrdered, dateOrderError);

export const editEventReqSchema = baseEventSchema.partial().refine(isDateOrdered, dateOrderError);
