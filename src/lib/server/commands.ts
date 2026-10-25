import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/db";
import {
  account,
  committeeAdmins,
  session,
  siteSettings,
  user,
} from "@/db/schema";
import { ensure } from "./errors";
import { schemas, type Command } from "./validation";
import { audit } from "./transaction";
import { periodCommand } from "./period-commands";
import { participantCommand } from "./participant-commands";
import { groupCommand } from "./group-commands";
import { cashCommand } from "./cash-commands";
import { correctionCommand } from "./correction-command";

export async function executeCommand(actor: string, cmd: Command) {
  // Expensive password hashing happens before any database lock is acquired.
  let hash: string | undefined;
  let previousHash: string | null = null;
  if (cmd.action === "admin.save" && !cmd.id) {
    const values = schemas.admin.parse(cmd.values);
    ensure(values.password, "Isi password awal panitia (minimal 12 karakter).");
    hash = await hashPassword(values.password);
  }
  if (cmd.action === "account.password") {
    const values = schemas.password.parse(cmd.values);
    ensure(
      values.password === values.confirm,
      "Konfirmasi password tidak sama.",
    );
    const [credential] = await db
      .select({ password: account.password })
      .from(account)
      .where(
        and(eq(account.userId, actor), eq(account.providerId, "credential")),
      );
    ensure(
      credential?.password &&
        (await verifyPassword({
          hash: credential.password,
          password: values.current,
        })),
      "Password saat ini tidak sesuai.",
    );
    previousHash = credential.password;
    hash = await hashPassword(values.password);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '15s'`);
    if (cmd.action.startsWith("admin.") || cmd.action === "account.password")
      await tx.execute(sql`select pg_advisory_xact_lock(81448001)`);
    const [admin] = await tx
      .select()
      .from(committeeAdmins)
      .where(eq(committeeAdmins.userId, actor))
      .for("share");
    ensure(admin?.isActive, "Akses panitia sudah tidak aktif.", 403);
    if (cmd.action.startsWith("period.")) return periodCommand(tx, actor, cmd);
    if (cmd.action.startsWith("participant."))
      return participantCommand(tx, actor, cmd);
    if (cmd.action.startsWith("group.")) return groupCommand(tx, actor, cmd);
    if (cmd.action === "cash.correct") return correctionCommand(tx, actor, cmd);
    if (cmd.action.startsWith("cash.")) return cashCommand(tx, actor, cmd);
    if (cmd.action === "settings.save") {
      const v = schemas.settings.parse(cmd.values);
      const values = {
        committeeName: v.name,
        contactName: v.contact,
        whatsappNumber: v.whatsapp,
        publicDescription: v.description,
        address: v.address,
        updatedBy: actor,
      };
      await tx
        .insert(siteSettings)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({ target: siteSettings.id, set: values });
      await audit(
        tx,
        actor,
        "Informasi publik diperbarui",
        "Pengaturan",
        "site_settings",
        "1",
        null,
        v.name,
      );
      return { id: "1" };
    }
    if (cmd.action === "account.password") {
      const [credential] = await tx
        .select()
        .from(account)
        .where(
          and(eq(account.userId, actor), eq(account.providerId, "credential")),
        )
        .for("update");
      ensure(
        credential?.password === previousHash,
        "Password telah berubah. Coba lagi.",
        409,
      );
      await tx
        .update(account)
        .set({ password: hash })
        .where(eq(account.id, credential.id));
      await tx.delete(session).where(eq(session.userId, actor));
      await audit(
        tx,
        actor,
        "Password diperbarui",
        "Pengaturan",
        "committee_admin",
        actor,
        null,
        "Seluruh sesi akun diakhiri setelah perubahan password.",
      );
      return { id: actor, reauthenticate: true };
    }
    if (cmd.action === "admin.save") {
      const v = schemas.admin.parse(cmd.values);
      if (!cmd.id) {
        const id = randomUUID();
        await tx.insert(user).values({ id, name: v.name, email: v.email });
        await tx.insert(account).values({
          id: randomUUID(),
          userId: id,
          accountId: id,
          providerId: "credential",
          password: hash,
        });
        await tx
          .insert(committeeAdmins)
          .values({ userId: id, createdBy: actor });
        await audit(
          tx,
          actor,
          "Akun panitia ditambahkan",
          "Pengaturan",
          "committee_admin",
          id,
          null,
          v.name,
        );
        return { id };
      }
      const [target] = await tx
        .select({ id: user.id, name: user.name, email: user.email })
        .from(committeeAdmins)
        .innerJoin(user, eq(user.id, committeeAdmins.userId))
        .where(eq(committeeAdmins.userId, cmd.id))
        .for("update", { of: user });
      ensure(target, "Akun panitia tidak ditemukan.", 404);
      const changed = target.email !== v.email;
      await tx
        .update(user)
        .set({
          name: v.name,
          email: v.email,
          ...(changed ? { emailVerified: false } : {}),
        })
        .where(eq(user.id, cmd.id));
      if (changed) await tx.delete(session).where(eq(session.userId, cmd.id));
      await audit(
        tx,
        actor,
        "Profil panitia diperbarui",
        "Pengaturan",
        "committee_admin",
        cmd.id,
        null,
        v.name,
      );
      return { id: cmd.id, reauthenticate: changed && cmd.id === actor };
    }
    const v = schemas.reason.parse(cmd.values);
    ensure(
      cmd.id && cmd.id !== actor,
      "Akun sendiri tidak dapat dinonaktifkan.",
    );
    const [target] = await tx
      .select()
      .from(committeeAdmins)
      .where(eq(committeeAdmins.userId, cmd.id))
      .for("update");
    ensure(target, "Akun panitia tidak ditemukan.", 404);
    // Explicit desired state makes retries safe; never blindly toggle a stale value.
    const active = cmd.values.active;
    ensure(typeof active === "boolean", "Isi status akses yang dituju.");
    await tx
      .update(committeeAdmins)
      .set({ isActive: active })
      .where(eq(committeeAdmins.userId, cmd.id));
    if (!active) await tx.delete(session).where(eq(session.userId, cmd.id));
    await audit(
      tx,
      actor,
      active ? "Panitia diaktifkan" : "Panitia dinonaktifkan",
      "Pengaturan",
      "committee_admin",
      cmd.id,
      null,
      v.reason,
    );
    return { id: cmd.id };
  });
}
