import { z } from "zod";

export const UserSchema = z.object({
    name: z.string(),
    age: z.number(),
});

export type User = z.infer<typeof UserSchema>
