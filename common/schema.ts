import { z } from "zod";

// ---------- 共通ID ----------
export const idSchema = z.string().uuid();

// ---------- Range ----------
export const RangeSchema = z.object({
  id: idSchema.optional(),
  startTime: z.string().datetime(), // 修正: time() → datetime()
  endTime: z.string().datetime(), // 修正: time() → datetime()
  eventId: idSchema.optional(),
});

// ---------- Slot ----------
export const SlotSchema = z.object({
  id: idSchema.optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  eventId: idSchema,
  guestId: idSchema.optional(),
});

// ---------- Host ----------
export const HostSchema = z.object({
  id: idSchema,
  name: z.string(),
  browserId: idSchema.optional(),
  eventId: idSchema,
});

// ---------- Guest ----------
export const GuestSchema = z.object({
  id: idSchema.optional(),
  name: z.string(),
  browserId: idSchema.optional(),
  eventId: idSchema,
  slots: z.array(SlotSchema).optional(),
});

// ---------- Event ----------
export const EventSchema = z.object({
  id: idSchema.optional(),
  name: z.string(),
  startDate: z.string().datetime(), // 修正: date() → datetime()
  endDate: z.string().datetime(), // 修正: date() → datetime()
  range: z.array(RangeSchema),
  slots: z.array(SlotSchema).optional(),
  hosts: z.array(HostSchema).optional(),
  guests: z.array(GuestSchema).optional(),
});
