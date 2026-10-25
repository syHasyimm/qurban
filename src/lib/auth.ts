import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { APIError, createAuthMiddleware } from "better-auth/api";

export const auth = betterAuth({
  appName: "Qurban",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  // Add OAuth providers here after supplying their private credentials.
  socialProviders: {},
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email =
        typeof ctx.body?.email === "string"
          ? ctx.body.email.trim().toLowerCase()
          : "";
      const [admin] = await db
        .select({ active: schema.committeeAdmins.isActive })
        .from(schema.user)
        .innerJoin(
          schema.committeeAdmins,
          eq(schema.committeeAdmins.userId, schema.user.id),
        )
        .where(eq(schema.user.email, email));
      if (!admin?.active)
        throw new APIError("UNAUTHORIZED", {
          message:
            "Email atau kata sandi tidak sesuai, atau akses panitia tidak aktif.",
        });
    }),
  },
  disabledPaths: [
    "/sign-up/email",
    "/update-user",
    "/change-email",
    "/delete-user",
    "/change-password",
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [admin] = await db
            .select({ active: schema.committeeAdmins.isActive })
            .from(schema.committeeAdmins)
            .where(eq(schema.committeeAdmins.userId, session.userId));
          if (!admin?.active) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});
