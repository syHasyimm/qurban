import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { qurbanRegistrations } from "@/db/schema";
import { ensure } from "./errors";
import {
  audit,
  editableGroup,
  refreshReady,
  type DbGroup,
  type Tx,
} from "./transaction";

// Caller holds the period and group locks for the entire transaction.
export async function addGroupMembers(
  tx: Tx,
  actor: string,
  group: DbGroup,
  ids: string[],
) {
  if (!ids.length) return;
  editableGroup(group);
  const registrations = await tx
    .select()
    .from(qurbanRegistrations)
    .where(
      and(
        inArray(qurbanRegistrations.id, ids),
        eq(qurbanRegistrations.periodId, group.periodId),
      ),
    )
    .orderBy(asc(qurbanRegistrations.id))
    .for("update");
  ensure(
    registrations.length === ids.length,
    "Peserta tidak ditemukan pada periode ini.",
  );
  ensure(
    registrations.every((r) => r.status === "active" && !r.groupId),
    "Peserta harus aktif dan masih berada dalam daftar tunggu. Muat ulang data pilihan Anda.",
    409,
  );
  const occupied = await tx
    .select({ slot: qurbanRegistrations.slotNumber })
    .from(qurbanRegistrations)
    .where(
      and(
        eq(qurbanRegistrations.groupId, group.id),
        eq(qurbanRegistrations.status, "active"),
      ),
    );
  const slots = Array.from(
    { length: group.expectedMembers },
    (_, i) => i + 1,
  ).filter((slot) => !occupied.some((r) => r.slot === slot));
  ensure(
    occupied.length + registrations.length <= group.expectedMembers &&
      slots.length >= registrations.length,
    "Jumlah peserta melebihi kapasitas kelompok. Sesuaikan pilihan atau jumlah anggota disepakati.",
    409,
  );
  for (let i = 0; i < registrations.length; i++) {
    const registration = registrations[i];
    await tx
      .update(qurbanRegistrations)
      .set({ groupId: group.id, slotNumber: slots[i] })
      .where(eq(qurbanRegistrations.id, registration.id));
    await audit(
      tx,
      actor,
      "Kelompok peserta diperbarui",
      "Peserta",
      "registration",
      registration.id,
      group.periodId,
      registration.qurbanName,
      { before: null, after: group.id },
    );
  }
  await refreshReady(tx, group);
}
