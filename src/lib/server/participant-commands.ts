import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { participants, qurbanRegistrations } from "@/db/schema";
import { ensure } from "./errors";
import { atNoon, schemas, type Command } from "./validation";
import {
  allocateSlot,
  audit,
  editableGroup,
  lockGroups,
  lockPeriod,
  lockRegistration,
  netBalance,
  refreshReady,
  registrationOpen,
  type Tx,
} from "./transaction";

export async function participantCommand(tx: Tx, actor: string, cmd: Command) {
  if (cmd.action === "participant.create") {
    const v = schemas.registration.parse(cmd.values);
    const period = await lockPeriod(tx, cmd.periodId);
    registrationOpen(period, v.registered);
    const [group] = await lockGroups(tx, [v.group]);
    const slot = group ? await allocateSlot(tx, group, period.id) : null;
    ensure(!v.group || group, "Kelompok tidak ditemukan.");
    let person;
    if (v.existing) {
      [person] = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, v.existing))
        .for("update");
      ensure(person && !person.archivedAt, "Data jamaah lama tidak tersedia.");
    } else {
      const name = v.name.trim();
      const phone = schemas.phone.parse(v.phone);
      ensure(name.length >= 2, "Isi nama lengkap minimal dua karakter.");
      // Serialize identical identity creation across periods without making family phones unique.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${name.toLowerCase()}|${phone}`}, 81448))`,
      );
      const [existing] = await tx
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.phone, phone),
            sql`lower(${participants.fullName}) = lower(${name})`,
          ),
        )
        .limit(1);
      ensure(
        !existing,
        "Nama dan kontak sudah tercatat. Gunakan data peserta lama untuk mendaftar kembali.",
        409,
      );
      [person] = await tx
        .insert(participants)
        .values({
          fullName: name,
          phone,
          address: v.address,
          notes: v.notes,
          createdBy: actor,
        })
        .returning();
    }
    const [existing] = await tx
      .select({ id: qurbanRegistrations.id })
      .from(qurbanRegistrations)
      .where(
        and(
          eq(qurbanRegistrations.participantId, person.id),
          eq(qurbanRegistrations.periodId, period.id),
        ),
      );
    ensure(
      !existing,
      "Jamaah sudah memiliki kepesertaan pada periode ini. Aktifkan kembali kepesertaan lama bila dibatalkan.",
      409,
    );
    const [count] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(qurbanRegistrations)
      .where(eq(qurbanRegistrations.periodId, period.id));
    const number = `Q${period.hijriYear}-${String(count.count + 1).padStart(4, "0")}`;
    const [r] = await tx
      .insert(qurbanRegistrations)
      .values({
        periodId: period.id,
        participantId: person.id,
        registrationNumber: number,
        qurbanName: person.fullName,
        groupId: group?.id ?? null,
        slotNumber: slot,
        registeredAt: atNoon(v.registered),
        notes: v.notes,
        createdBy: actor,
      })
      .returning({ id: qurbanRegistrations.id });
    await audit(
      tx,
      actor,
      "Peserta didaftarkan",
      "Peserta",
      "registration",
      r.id,
      period.id,
      `${person.fullName} · ${number}`,
      { participantId: person.id, groupId: group?.id ?? null },
    );
    return { id: r.id };
  }
  const targetGroup =
    cmd.action === "participant.assign"
      ? schemas.assignment.parse(cmd.values).group
      : undefined;
  const {
    period,
    registration: r,
    group,
    target: destination,
  } = await lockRegistration(tx, cmd.id!, cmd.periodId, targetGroup);
  if (cmd.action === "participant.update") {
    const v = schemas.participant.parse(cmd.values);
    await tx
      .update(participants)
      .set({ fullName: v.name, phone: v.phone, address: v.address })
      .where(eq(participants.id, r.participantId));
    await tx
      .update(qurbanRegistrations)
      .set({ qurbanName: v.name, notes: v.notes })
      .where(eq(qurbanRegistrations.id, r.id));
    await audit(
      tx,
      actor,
      "Data peserta diperbarui",
      "Peserta",
      "registration",
      r.id,
      period.id,
      v.name,
    );
    return { id: r.id };
  }
  const net = await netBalance(tx, r.id);
  if (group && cmd.action !== "participant.reactivate") editableGroup(group);
  ensure(
    net === 0,
    "Selesaikan pengembalian seluruh setoran bersih sebelum mengubah kelompok atau kepesertaan.",
  );
  if (cmd.action === "participant.assign") {
    ensure(r.status === "active", "Kepesertaan sudah dibatalkan.");
    ensure(!targetGroup || destination, "Kelompok tujuan tidak ditemukan.");
    const slot = destination
      ? await allocateSlot(tx, destination, period.id, r.id)
      : null;
    await tx
      .update(qurbanRegistrations)
      .set({ groupId: destination?.id ?? null, slotNumber: slot })
      .where(eq(qurbanRegistrations.id, r.id));
    if (group) await refreshReady(tx, group);
    if (destination && destination.id !== group?.id)
      await refreshReady(tx, destination);
    await audit(
      tx,
      actor,
      "Kelompok peserta diperbarui",
      "Peserta",
      "registration",
      r.id,
      period.id,
      r.qurbanName,
      { before: r.groupId, after: destination?.id ?? null },
    );
  } else {
    const v = schemas.reason.parse(cmd.values);
    if (cmd.action === "participant.cancel") {
      ensure(r.status === "active", "Kepesertaan sudah dibatalkan.");
      await tx
        .update(qurbanRegistrations)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: actor,
          cancellationReason: v.reason,
        })
        .where(eq(qurbanRegistrations.id, r.id));
    } else {
      registrationOpen(period);
      ensure(r.status === "cancelled", "Peserta sudah aktif.");
      await tx
        .update(qurbanRegistrations)
        .set({
          status: "active",
          groupId: null,
          slotNumber: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
        })
        .where(eq(qurbanRegistrations.id, r.id));
    }
    if (group) await refreshReady(tx, group);
    await audit(
      tx,
      actor,
      cmd.action === "participant.cancel"
        ? "Kepesertaan dibatalkan"
        : "Kepesertaan diaktifkan kembali",
      "Peserta",
      "registration",
      r.id,
      period.id,
      `${r.qurbanName} · ${v.reason}`,
      { reason: v.reason },
    );
  }
  return { id: r.id };
}
