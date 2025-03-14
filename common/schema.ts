import { z } from "zod";

// ---------- 共通ID ----------
export const idSchema = z.string().uuid();

// ---------- Range ----------
export const RangeSchema = z.object({
  id: idSchema.optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eventId: idSchema.optional(),
});

// ---------- Slot ----------
export const SlotSchema = z.object({
  id: idSchema.optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  eventId: idSchema.optional(),
  guestId: idSchema.optional(),
});

// ---------- Host (一旦仮の型にしておく) ----------
export const HostSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: idSchema,
    name: z.string(),
    browserId: idSchema.optional(),
    eventId: idSchema,
    event: EventSchema.optional(), // ★ ここは lazy されるので安全
  })
);

// ---------- Guest (一旦仮の型にしておく) ----------
export const GuestSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: idSchema.optional(),
    name: z.string(),
    browserId: idSchema.optional(),
    eventId: idSchema,
    event: EventSchema.optional(), // ★
    slots: z.array(SlotSchema).optional(),
  })
);

// ---------- Event ----------
export const EventSchema = z.object({
  id: idSchema.optional(),
  name: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  range: z.array(RangeSchema),
  slots: z.array(SlotSchema).optional(),
  hosts: z.array(HostSchema).optional(), // ★ lazy 済
  guests: z.array(GuestSchema).optional(), // ★ lazy 済
});
