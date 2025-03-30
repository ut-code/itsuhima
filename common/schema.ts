import { z } from "zod";

// TODO: Is this the best way?
const isoStrToDate = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

const host = z.object({
  id: z.string().uuid(),
  projectId: z.string().length(21),
});

const guest = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectId: z.string().length(21),
});

const project = z.object({
  id: z.string().length(21),
  name: z.string(),
  startDate: isoStrToDate,
  endDate: isoStrToDate,
});

const allowedRange = z.object({
  id: z.string().uuid(),
  projectId: z.string().length(21),
  startTime: isoStrToDate,
  endTime: isoStrToDate,
});

const slot = z.object({
  id: z.string().uuid(),
  projectId: z.string().length(21),
  guestId: z.string().uuid(),
  from: isoStrToDate,
  to: isoStrToDate,
});

export const submitReqSchema = z.object({
  name: z.string(),
  projectId: z.string().length(21),
  slots: z.array(
    z.object({
      start: isoStrToDate,
      end: isoStrToDate,
    }),
  ),
});

export type SubmitReq = z.infer<typeof submitReqSchema>;

const isQuarterHour = (time: string): boolean => {
  const [, minute] = time.split(":").map(Number);
  return [0, 15, 30, 45].includes(minute);
};

const baseProjectReqSchema = z.object({
  name: z.string().min(1, "イベント名を入力してください"),
  startDate: z
    .string()
    .min(1, "開始日を入力してください"),
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
    .refine(
      (ranges) => ranges.every(({ startTime, endTime }) => startTime < endTime),
      {
        message: "開始時刻は終了時刻より前でなければなりません",
      },
    )
    .refine(
      (ranges) =>
        ranges.every(
          ({ startTime, endTime }) =>
            isQuarterHour(startTime) && isQuarterHour(endTime),
        ),
      {
        message: "開始時刻と終了時刻は15分単位で入力してください",
      },
    ),
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
export const projectResSchema = project.extend({
  allowedRanges: z.array(allowedRange),
  hosts: z.array(host),
  guests: z.array(
    guest.extend({
      slots: z.array(slot),
    }),
  ),
  isHost: z.boolean(),
  meAsGuest: guest.nullable(),
});

export type ProjectRes = z.infer<typeof projectResSchema>;

export const involvedProjectsResSchema = z.array(
  project.extend({
    isHost: z.boolean(),
  }),
);

export type InvolvedProjects = z.infer<typeof involvedProjectsResSchema>;

// export const GuestSchema = z.object({
//   id: z.string.optional(),
//   name: z.string(),
//   browserId: idSchema.optional(),
//   eventId: idSchema,
//   slots: z.array(SlotSchema).optional(),
// });

// ---------- Range ----------
// export const RangeSchema = z.object({
//   id: idSchema.optional(),
//   startTime: z.string().datetime(),
//   endTime: z.string().datetime(),
//   eventId: idSchema.optional(),
// });

// ---------- Slot ----------
// export const SlotSchema = z.object({
//   id: idSchema.optional(),
//   start: z.string().datetime(),
//   end: z.string().datetime(),
//   eventId: idSchema.optional(),
//   guestId: idSchema.optional(),
// });

// // ---------- Event ----------
// export const EventSchema = z.object({
//   id: idSchema.optional(),
//   name: z.string(),
//   startDate: z.string().datetime(),
//   endDate: z.string().datetime(),
//   range: z.array(RangeSchema),
//   slots: z.array(SlotSchema).optional(),
//   hosts: z.array(HostRes).optional(),
//   guests: z.array(GuestSchema).optional(),
// });
