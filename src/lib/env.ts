import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) =>
        value !== "replace-with-a-random-secret-at-least-32-characters",
      "Generate a private BETTER_AUTH_SECRET before starting the application.",
    ),
  BETTER_AUTH_URL: z.url(),
});

export const env = environmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
});
