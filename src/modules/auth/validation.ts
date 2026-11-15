import { z } from "zod";
export const credentialsSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10).max(128),
});
export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});
