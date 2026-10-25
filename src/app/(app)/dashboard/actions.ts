"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { executeCommand } from "@/lib/server/commands";
import { profileSchema } from "@/lib/validations/auth";

export async function updateProfile(values: unknown) {
  const admin = await requireAdmin();
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success)
    return { error: "Nama harus terdiri dari 2–80 karakter." };
  try {
    await executeCommand(admin.user.id, {
      action: "admin.save",
      id: admin.user.id,
      periodId: "",
      requestId: crypto.randomUUID(),
      values: { name: parsed.data.name, email: admin.user.email },
    });
  } catch {
    return { error: "Nama belum dapat disimpan. Silakan coba lagi." };
  }
  revalidatePath("/dashboard");
  return { success: true };
}
