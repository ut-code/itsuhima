import { z } from "zod";

// ---------- Range ----------
export const RangeSchema = z.object({
  id: z.string().uuid().optional(),
  startTime: z.string().time(),
  endTime: z.string().time(),
  eventId: z.string().uuid().optional(),
});

// ---------- Slot ----------
export const SlotSchema = z.object({
  id: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
});

// ---------- Host ----------
export const HostSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  browserId: z.string().uuid(), // Prismaの@default(uuid())に対応
  eventId: z.string().uuid(),
});

// ---------- Guest ----------
export const GuestSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  browserId: z.string().uuid(),
  eventId: z.string().uuid(),
});

// ---------- Event ----------
export const EventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  // 配列の関係部分（関連オブジェクトとの関係）は個別に使う時に組み合わせる
  range: z.array(RangeSchema),
  slots: z.array(SlotSchema).optional(),
  hosts: z.array(HostSchema).optional(),
  guests: z.array(GuestSchema).optional(),
});
