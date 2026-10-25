import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLogs,
  cashTransactions,
  qurbanGroups,
  qurbanPeriods,
  qurbanRegistrations,
} from "@/db/schema";
import { ensure } from "./errors";
import { jakartaToday } from "./validation";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbGroup = typeof qurbanGroups.$inferSelect;
export type DbPeriod = typeof qurbanPeriods.$inferSelect;
export function validId(id?: string): string {
  ensure(z.uuid().safeParse(id).success, "ID data tidak valid.");
  return id!;
}
export async function lockPeriod(tx: Tx, id: string, writable = true) {
  const [period] = await tx
    .select()
    .from(qurbanPeriods)
    .where(eq(qurbanPeriods.id, validId(id)))
    .for("update");
  ensure(period, "Periode tidak ditemukan.", 404);
  if (writable)
    ensure(
      !["completed", "archived"].includes(period.status),
      "Periode selesai/arsip hanya dapat dibaca. Buka kembali dengan alasan terlebih dahulu.",
    );
  return period;
}
export function registrationOpen(period: DbPeriod, date = jakartaToday()) {
  const today = jakartaToday();
  ensure(
    period.status === "open",
    "Pendaftaran hanya diterima pada periode yang dibuka.",
  );
  ensure(
    today >= period.registrationStartsOn && today <= period.registrationEndsOn,
    "Saat ini berada di luar rentang pendaftaran. Ubah jadwal periode dengan alasan bila diperlukan.",
  );
  ensure(
    date >= period.registrationStartsOn &&
      date <= period.registrationEndsOn &&
      date <= today,
    "Tanggal pendaftaran di luar jadwal atau berada di masa depan.",
  );
}
export async function lockGroups(tx: Tx, ids: (string | null | undefined)[]) {
  const valid = [...new Set(ids.filter((id): id is string => !!id))].sort();
  return valid.length
    ? tx
        .select()
        .from(qurbanGroups)
        .where(inArray(qurbanGroups.id, valid))
        .orderBy(asc(qurbanGroups.id))
        .for("update")
    : [];
}
export async function lockGroup(tx: Tx, id: string, claimedPeriod: string) {
  const [found] = await tx
    .select({ periodId: qurbanGroups.periodId })
    .from(qurbanGroups)
    .where(eq(qurbanGroups.id, validId(id)));
  ensure(found, "Kelompok tidak ditemukan.", 404);
  ensure(
    !claimedPeriod || found.periodId === claimedPeriod,
    "Kelompok berasal dari periode lain.",
  );
  const period = await lockPeriod(tx, found.periodId);
  const [group] = await lockGroups(tx, [id]);
  return { period, group };
}
export async function lockRegistration(
  tx: Tx,
  id: string,
  claimedPeriod: string,
  targetGroup?: string,
) {
  const [found] = await tx
    .select({ periodId: qurbanRegistrations.periodId })
    .from(qurbanRegistrations)
    .where(eq(qurbanRegistrations.id, validId(id)));
  ensure(found, "Peserta tidak ditemukan.", 404);
  ensure(
    !claimedPeriod || found.periodId === claimedPeriod,
    "Peserta berasal dari periode lain.",
  );
  const period = await lockPeriod(tx, found.periodId);
  const [current] = await tx
    .select()
    .from(qurbanRegistrations)
    .where(eq(qurbanRegistrations.id, id));
  const groups = await lockGroups(tx, [current.groupId, targetGroup]);
  const [registration] = await tx
    .select()
    .from(qurbanRegistrations)
    .where(eq(qurbanRegistrations.id, id))
    .for("update");
  return {
    period,
    registration,
    group: groups.find((g) => g.id === registration.groupId),
    target: groups.find((g) => g.id === targetGroup),
  };
}
export function target(group: DbGroup) {
  return Math.ceil(
    Number(group.finalTotal ?? group.estimatedTotal) / group.expectedMembers,
  );
}
export async function netBalance(tx: Tx, registrationId: string) {
  const [row] = await tx
    .select({
      net: sql<string>`coalesce(sum(case when ${cashTransactions.entryType} = 'deposit' then ${cashTransactions.amount} else -${cashTransactions.amount} end), 0)`,
    })
    .from(cashTransactions)
    .where(
      and(
        eq(cashTransactions.registrationId, registrationId),
        isNull(cashTransactions.voidedAt),
      ),
    );
  return Number(row.net);
}
export async function membersWithBalance(tx: Tx, groupId: string) {
  return tx
    .select({
      id: qurbanRegistrations.id,
      status: qurbanRegistrations.status,
      net: sql<string>`coalesce(sum(case when ${cashTransactions.voidedAt} is not null then 0 when ${cashTransactions.entryType} = 'deposit' then ${cashTransactions.amount} else -${cashTransactions.amount} end), 0)`,
    })
    .from(qurbanRegistrations)
    .leftJoin(
      cashTransactions,
      eq(cashTransactions.registrationId, qurbanRegistrations.id),
    )
    .where(eq(qurbanRegistrations.groupId, groupId))
    .groupBy(qurbanRegistrations.id);
}
export async function refreshReady(tx: Tx, group: DbGroup) {
  const allMembers = await membersWithBalance(tx, group.id);
  if (group.status === "cancelled") {
    ensure(
      allMembers.every((m) => m.status !== "active" && Number(m.net) === 0),
      "Kelompok batal masih memiliki anggota atau kewajiban.",
    );
    return "cancelled";
  }
  const members = allMembers.filter((m) => m.status === "active");
  const ready =
    !!group.priceLockedAt &&
    members.length === group.expectedMembers &&
    members.every((m) => Number(m.net) === target(group));
  if (["purchased", "slaughtered"].includes(group.status)) {
    ensure(ready, "Perubahan mengurangi pelunasan kelompok yang telah dibeli.");
    return group.status;
  }
  const status = group.priceLockedAt
    ? ready
      ? "ready"
      : "collecting"
    : "forming";
  await tx
    .update(qurbanGroups)
    .set({ status })
    .where(eq(qurbanGroups.id, group.id));
  return status;
}
export function editableGroup(group: DbGroup) {
  ensure(
    !group.priceLockedAt && ["forming", "collecting"].includes(group.status),
    "Buka kembali kelompok sebelum mengubah harga/anggota. Sapi yang telah dibeli tidak dapat diubah.",
  );
}
export async function allocateSlot(
  tx: Tx,
  group: DbGroup,
  periodId: string,
  except?: string,
) {
  ensure(group.periodId === periodId, "Kelompok berasal dari periode lain.");
  editableGroup(group);
  const members = await tx
    .select({
      id: qurbanRegistrations.id,
      slot: qurbanRegistrations.slotNumber,
    })
    .from(qurbanRegistrations)
    .where(
      and(
        eq(qurbanRegistrations.groupId, group.id),
        eq(qurbanRegistrations.status, "active"),
      ),
    );
  const occupied = members.filter((m) => m.id !== except).map((m) => m.slot);
  const slot = Array.from(
    { length: group.expectedMembers },
    (_, i) => i + 1,
  ).find((n) => !occupied.includes(n));
  ensure(
    slot,
    "Kelompok sudah penuh. Pilih kelompok lain atau gunakan daftar tunggu.",
    409,
  );
  return slot;
}
export async function audit(
  tx: Tx,
  actor: string,
  action: string,
  category: string,
  entityType: string,
  entityId: string,
  periodId: string | null,
  detail: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(auditLogs).values({
    actorId: actor,
    action,
    entityType,
    entityId,
    periodId,
    metadata: { ...metadata, category, detail },
  });
}
