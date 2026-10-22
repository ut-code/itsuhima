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
  name: z.string().min(1, "名前を入力してください").max(50, "名前は50文字以内で入力してください"),
  projectId: z.string().length(21),
  comment: z.string().max(500, "コメントは500文字以内で入力してください").nullable().optional(),
  slots: z.array(
    z.object({
      start: isoStrToDate,
      end: isoStrToDate,
      participationOptionId: z.string().uuid(),
    }),
  ),
});

/** フォームの時刻 ("HH:mm") */
const formTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻の形式が正しくありません");

/** "HH:mm" の分が 15 の倍数か */
const isQuarterHourFormTime = (time: string): boolean => {
  const [, minute] = time.split(":").map(Number);
  return [0, 15, 30, 45].includes(minute);
};

/** ISO 8601 の日時の分が 15 の倍数で、秒以下が 0 か。Asia/Tokyo のオフセットは 15 分の倍数なので UTC で判定してよい。 */
const isQuarterHourDateTime = (dateTime: string): boolean => new Date(dateTime).getTime() % (15 * 60 * 1000) === 0;

/**
 * イベントの作成・編集の入力。フォームと API で、日付・時刻の形式だけが異なる。
 * フォームは "YYYY-MM-DD" と "HH:mm"、API は ISO 8601 の日時で受け取る (Web UI が変換して送る)。
 */
function baseProjectSchema({
  startDate,
  endDate,
  time,
  isQuarterHour,
}: {
  startDate: z.ZodString;
  endDate: z.ZodString;
  time: z.ZodString;
  isQuarterHour: (time: string) => boolean;
}) {
  return z.object({
    name: z.string().min(1, "イベント名を入力してください").max(100, "イベント名は100文字以内で入力してください"),
    description: z.string().max(1000, "説明は1000文字以内で入力してください"),
    startDate,
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
    endDate,
    allowedRanges: z
      .array(
        z.object({
          startTime: time,
          endTime: time,
        }),
      )
      .refine((ranges) => ranges.every(({ startTime, endTime }) => startTime < endTime), {
        message: "開始時刻は終了時刻より前でなければなりません",
      })
      .refine(
        (ranges) => ranges.every(({ startTime, endTime }) => isQuarterHour(startTime) && isQuarterHour(endTime)),
        {
          message: "開始時刻と終了時刻は15分単位で入力してください",
        },
      ),
    participationOptions: z.array(participationOptionCreateSchema).min(1, "参加形態は最低1つ必要です"),
  });
}

const baseProjectFormSchema = baseProjectSchema({
  startDate: z.string().min(1, "開始日を入力してください").date("開始日の形式が正しくありません"),
  endDate: z.string().min(1, "終了日を入力してください").date("終了日の形式が正しくありません"),
  time: formTime,
  isQuarterHour: isQuarterHourFormTime,
});

const baseProjectReqSchema = baseProjectSchema({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  time: z.string().datetime(),
  isQuarterHour: isQuarterHourDateTime,
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

export const projectFormSchema = baseProjectFormSchema.refine(isDateOrdered, dateOrderError);

export const editFormSchema = baseProjectFormSchema.partial().refine(isDateOrdered, dateOrderError);

export const projectReqSchema = baseProjectReqSchema.refine(isDateOrdered, dateOrderError);

export const editReqSchema = baseProjectReqSchema.partial().refine(isDateOrdered, dateOrderError);
