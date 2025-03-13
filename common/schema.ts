import { z } from "zod";

export const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

export type User = z.infer<typeof UserSchema>;

export const SlotSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime(),
});
