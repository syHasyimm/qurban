import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { committeeAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/server/errors";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export const getActiveAdmin = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const [admin] = await db
    .select()
    .from(committeeAdmins)
    .where(eq(committeeAdmins.userId, session.user.id));
  return admin?.isActive ? session : null;
});
export async function requireAdmin() {
  if (!(await getSession())) redirect("/login");
  const session = await getActiveAdmin();
  if (!session) redirect("/login?akses=ditolak");
  return session;
}
export async function apiAdmin() {
  const session = await getSession();
  if (!session) throw new DomainError("Silakan masuk kembali.", 401);
  const active = await getActiveAdmin();
  if (!active)
    throw new DomainError(
      "Akses panitia tidak aktif atau tidak diizinkan.",
      403,
    );
  return active;
}
