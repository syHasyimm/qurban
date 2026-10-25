import "server-only";
import { asc, eq } from "drizzle-orm";
import { qurbanGroups, qurbanRegistrations } from "@/db/schema";
import { ensure } from "./errors";
import { addGroupMembers } from "./group-members";
import { atNoon, jakartaToday, schemas, type Command } from "./validation";
import {
  audit,
  editableGroup,
  lockGroup,
  lockPeriod,
  membersWithBalance,
  refreshReady,
  type Tx,
} from "./transaction";

export async function groupCommand(tx: Tx, actor: string, cmd: Command) {
  if (cmd.action === "group.save" && !cmd.id) {
    const v = schemas.group.parse(cmd.values);
    const period = await lockPeriod(tx, cmd.periodId);
    const [g] = await tx
      .insert(qurbanGroups)
      .values({
        periodId: period.id,
        code: v.name,
        breed: v.breed,
        expectedMembers: v.expected,
        estimatedTotal: String(v.estimate),
        notes: v.notes,
        createdBy: actor,
      })
      .returning();
    await addGroupMembers(tx, actor, g, v.memberIds);
    await audit(
      tx,
      actor,
      "Kelompok dibuat",
      "Kelompok",
      "group",
      g.id,
      period.id,
      v.name,
    );
    return { id: g.id };
  }
  const { period, group: g } = await lockGroup(tx, cmd.id!, cmd.periodId);
  ensure(
    g.status !== "cancelled",
    "Kelompok yang dibatalkan tidak dapat diubah.",
  );
  const members = await membersWithBalance(tx, g.id);
  const active = members.filter((m) => m.status === "active");
  let action = "";
  let reason = "";
  if (cmd.action === "group.save") {
    editableGroup(g);
    const v = schemas.group.parse(cmd.values);
    ensure(
      active.length + v.memberIds.length <= v.expected,
      "Jumlah anggota disepakati lebih kecil daripada anggota aktif dan peserta yang dipilih.",
    );
    // Compact at most seven slots without changing members or their balances.
    const slots = await tx
      .select({
        id: qurbanRegistrations.id,
        slot: qurbanRegistrations.slotNumber,
        status: qurbanRegistrations.status,
      })
      .from(qurbanRegistrations)
      .where(eq(qurbanRegistrations.groupId, g.id))
      .orderBy(asc(qurbanRegistrations.slotNumber));
    const activeSlots = slots.filter((r) => r.status === "active");
    for (let i = 0; i < activeSlots.length; i++) {
      if (activeSlots[i].slot !== i + 1)
        await tx
          .update(qurbanRegistrations)
          .set({ slotNumber: i + 1 })
          .where(eq(qurbanRegistrations.id, activeSlots[i].id));
    }
    const [changedGroup] = await tx
      .update(qurbanGroups)
      .set({
        code: v.name,
        breed: v.breed,
        expectedMembers: v.expected,
        estimatedTotal: String(v.estimate),
        notes: v.notes,
      })
      .where(eq(qurbanGroups.id, g.id))
      .returning();
    await addGroupMembers(tx, actor, changedGroup, v.memberIds);
    action = "Kelompok diperbarui";
  } else if (cmd.action === "group.add-members") {
    const v = schemas.groupMembers.parse(cmd.values);
    await addGroupMembers(tx, actor, g, v.memberIds);
    action = "Peserta ditambahkan ke kelompok";
  } else if (cmd.action === "group.lock") {
    editableGroup(g);
    const v = schemas.lock.parse(cmd.values);
    ensure(
      active.length === g.expectedMembers,
      "Jumlah anggota aktif harus sesuai kesepakatan sebelum harga dikunci.",
    );
    const locked = {
      ...g,
      finalTotal: String(v.final),
      priceLockedAt: new Date(),
    };
    await tx
      .update(qurbanGroups)
      .set({
        finalTotal: locked.finalTotal,
        priceLockedAt: locked.priceLockedAt,
        notes: `${g.notes ?? ""}\nKesepakatan: ${v.reason}`,
      })
      .where(eq(qurbanGroups.id, g.id));
    await refreshReady(tx, locked);
    action = "Harga dan anggota dikunci";
    reason = v.reason;
  } else if (cmd.action === "group.reopen") {
    const v = schemas.reason.parse(cmd.values);
    ensure(
      !!g.priceLockedAt && ["collecting", "ready"].includes(g.status),
      "Kelompok hanya dapat dibuka kembali sebelum pembelian.",
    );
    await tx
      .update(qurbanGroups)
      .set({ finalTotal: null, priceLockedAt: null, status: "forming" })
      .where(eq(qurbanGroups.id, g.id));
    action = "Kelompok dibuka kembali";
    reason = v.reason;
  } else if (cmd.action === "group.purchase") {
    const v = schemas.purchase.parse(cmd.values);
    ensure(
      g.status === "ready" && (await refreshReady(tx, g)) === "ready",
      "Seluruh anggota harus lunas dan harga terkunci sebelum pembelian.",
    );
    ensure(
      v.cost <= Number(g.finalTotal),
      "Harga beli melebihi anggaran final yang disepakati.",
    );
    ensure(
      v.date >= period.registrationStartsOn && v.date <= jakartaToday(),
      "Tanggal pembelian berada di luar periode atau di masa depan.",
    );
    await tx
      .update(qurbanGroups)
      .set({
        purchaseCost: String(v.cost),
        purchasedAt: atNoon(v.date),
        status: "purchased",
        notes: `${g.notes ?? ""}\nPembelian: ${v.notes}`,
      })
      .where(eq(qurbanGroups.id, g.id));
    action = "Pembelian sapi dicatat";
  } else if (cmd.action === "group.slaughter") {
    const v = schemas.slaughter.parse(cmd.values);
    ensure(
      g.status === "purchased" && g.purchasedAt,
      "Catat pembelian sapi terlebih dahulu.",
    );
    ensure(
      atNoon(v.date) >= g.purchasedAt && v.date <= jakartaToday(),
      "Pelaksanaan tidak boleh mendahului pembelian atau berada di masa depan.",
    );
    await tx
      .update(qurbanGroups)
      .set({ slaughteredAt: atNoon(v.date), status: "slaughtered" })
      .where(eq(qurbanGroups.id, g.id));
    action = "Pelaksanaan qurban dicatat";
  } else {
    const v = schemas.reason.parse(cmd.values);
    ensure(
      !["purchased", "slaughtered"].includes(g.status),
      "Sapi yang telah dibeli tidak dapat dibatalkan.",
    );
    ensure(
      active.length === 0 && members.every((m) => Number(m.net) === 0),
      "Selesaikan pengembalian dan kepesertaan seluruh anggota dahulu.",
    );
    await tx
      .update(qurbanGroups)
      .set({ status: "cancelled" })
      .where(eq(qurbanGroups.id, g.id));
    action = "Kelompok dibatalkan";
    reason = v.reason;
  }
  const [changed] = await tx
    .select()
    .from(qurbanGroups)
    .where(eq(qurbanGroups.id, g.id));
  await audit(
    tx,
    actor,
    action,
    "Kelompok",
    "group",
    g.id,
    period.id,
    `${g.code}${reason ? ` · ${reason}` : ""}`,
    {
      reason,
      before: {
        expectedMembers: g.expectedMembers,
        estimatedTotal: g.estimatedTotal,
        finalTotal: g.finalTotal,
        status: g.status,
        priceLockedAt: g.priceLockedAt,
      },
      after: {
        expectedMembers: changed.expectedMembers,
        estimatedTotal: changed.estimatedTotal,
        finalTotal: changed.finalTotal,
        status: changed.status,
        priceLockedAt: changed.priceLockedAt,
        purchaseCost: changed.purchaseCost,
        purchasedAt: changed.purchasedAt,
        slaughteredAt: changed.slaughteredAt,
      },
    },
  );
  return { id: g.id };
}
