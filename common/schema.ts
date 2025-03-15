import { z } from "zod";

// TODO: Is this the best way?
const isoStrToDate = z.string().datetime().transform((str) => new Date(str));

const host = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
});

const guest = z.object({
  id: z.string().uuid(),
  name: z.string(),
  eventId: z.string().uuid(),
});

const project = z.object({
  id: z.string().uuid(),
  name: z.string(),
  startDate: isoStrToDate,
  endDate: isoStrToDate,
});

const range = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  startTime: isoStrToDate,
  endTime: isoStrToDate,
});

const slot = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  start: isoStrToDate,
  end: isoStrToDate,
});

export const submitReqSchema = z.object({
  name: z.string(),
  eventId: z.string().uuid(),
  slots: z.array(z.object({
    start: isoStrToDate,
    end: isoStrToDate,
  })), // TODO: should rename
})

export type SubmitReq = z.infer<typeof submitReqSchema>;

// ---------- Guest (一旦仮の型にしておく) ----------
export const projectReqSchema = z.object({
  name: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  ranges: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })),
});

export const projectResSchema = project.extend({
  ranges: z.array(range),
  hosts: z.array(host),
  guests: z.array(
    guest.extend({
      slots: z.array(slot),
    })
  ),
});

export type Project = z.infer<typeof projectResSchema>;

export const involvedProjectsResSchema = z.object({
  asHost: z.array(project),
  asGuest: z.array(project),
})

export type InvolvedProjects = z.infer<typeof involvedProjectsResSchema>;

export const meResSchema = z.object({
  guests: z.array(guest),
  hosts: z.array(host),
})

export type Me = z.infer<typeof meResSchema>;

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
