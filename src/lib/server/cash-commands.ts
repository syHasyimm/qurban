import "server-only";
import { and, eq } from "drizzle-orm";
import { cashTransactions } from "@/db/schema";
import { ensure } from "./errors";
import { atCashTime, jakartaToday, schemas, type Command } from "./validation";
import {
  audit,
  lockRegistration,
  netBalance,
  refreshReady,
  target,
  validId,
  type Tx,
} from "./transaction";

export async function cashCommand(tx: Tx, actor: string, cmd: Command) {
  if (cmd.action === "cash.create") {
    const v = schemas.cash.parse(cmd.values);
    const [saved] = await tx
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.idempotencyKey, cmd.requestId));
    if (saved) {
      ensure(
        saved.registrationId === v.participant &&
          saved.entryType === v.type &&
          Number(saved.amount) === v.amount &&
          saved.transactedAt.getTime() ===
            atCashTime(v.date, v.time).getTime() &&
          (saved.notes ?? "") === v.notes &&
          saved.recordedBy === actor,
        "Kunci pengulangan sudah digunakan untuk rincian transaksi lain.",
        409,
      );
      return { id: saved.id, receipt: saved.receiptNumber, replayed: true };
    }
    // Lock period -> group -> registration, then re-read idempotency and balance.
    const {
      period,
      registration: r,
      group,
    } = await lockRegistration(tx, v.participant, cmd.periodId);
    const [existing] = await tx
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.idempotencyKey, cmd.requestId));
    if (existing) {
      ensure(
        existing.registrationId === v.participant &&
          existing.entryType === v.type &&
          Number(existing.amount) === v.amount &&
          existing.transactedAt.getTime() ===
            atCashTime(v.date, v.time).getTime() &&
          (existing.notes ?? "") === v.notes &&
          existing.recordedBy === actor,
        "Kunci pengulangan sudah digunakan untuk rincian transaksi lain. Buka formulir baru untuk transaksi baru.",
        409,
      );
      return {
        id: existing.id,
        receipt: existing.receiptNumber,
        replayed: true,
      };
    }
    ensure(
      r.status === "active" && group && group.status !== "cancelled",
      "Pilih peserta aktif yang telah mendapat kelompok dan target iuran.",
    );
    ensure(
      ["open", "closed"].includes(period.status),
      "Periode belum menerima transaksi.",
    );
    const today = jakartaToday();
    ensure(
      v.date >= period.registrationStartsOn && v.date <= today,
      "Tanggal transaksi berada di luar periode atau di masa depan.",
    );
    if (v.type === "deposit")
      ensure(
        today >= period.registrationStartsOn &&
          today <= period.paymentDueOn &&
          v.date <= period.paymentDueOn,
        "Batas pelunasan sudah lewat atau penerimaan iuran belum dimulai. Perbarui jadwal periode dengan alasan terlebih dahulu.",
      );
    if (v.type === "refund")
      ensure(
        v.notes.length >= 5,
        "Isi alasan pengembalian minimal lima karakter.",
      );
    const net = await netBalance(tx, r.id);
    ensure(
      v.type === "deposit"
        ? v.amount <= Math.max(target(group) - net, 0)
        : v.amount <= net,
      v.type === "deposit"
        ? "Setoran melebihi sisa kewajiban peserta."
        : "Pengembalian melebihi setoran bersih peserta.",
    );
    const receipt = `KWT-${period.hijriYear}-${cmd.requestId.toUpperCase()}`;
    const [entry] = await tx
      .insert(cashTransactions)
      .values({
        registrationId: r.id,
        entryType: v.type,
        amount: String(v.amount),
        paymentMethod: "cash",
        receiptNumber: receipt,
        idempotencyKey: cmd.requestId,
        transactedAt: atCashTime(v.date, v.time),
        recordedBy: actor,
        notes: v.notes,
      })
      .returning({ id: cashTransactions.id });
    const nextStatus = await refreshReady(tx, group);
    await audit(
      tx,
      actor,
      v.type === "deposit"
        ? "Setoran tunai dicatat"
        : "Pengembalian tunai dicatat",
      "Keuangan",
      "cash_transaction",
      entry.id,
      period.id,
      `${r.qurbanName} · ${receipt} · Rp${v.amount.toLocaleString("id-ID")}`,
      {
        registrationId: r.id,
        entryType: v.type,
        amount: v.amount,
        requestId: cmd.requestId,
        groupId: group.id,
        groupStatusBefore: group.status,
        groupStatusAfter: nextStatus,
      },
    );
    return { id: entry.id, receipt };
  }
  const v = schemas.reason.parse(cmd.values);
  const [found] = await tx
    .select({ registrationId: cashTransactions.registrationId })
    .from(cashTransactions)
    .where(eq(cashTransactions.id, validId(cmd.id)));
  ensure(found, "Transaksi tidak ditemukan.", 404);
  const {
    period,
    registration: r,
    group,
  } = await lockRegistration(tx, found.registrationId, cmd.periodId);
  const [entry] = await tx
    .select()
    .from(cashTransactions)
    .where(eq(cashTransactions.id, cmd.id!))
    .for("update");
  if (entry.voidedAt) {
    ensure(
      entry.voidReason === v.reason && entry.voidedBy === actor,
      "Transaksi telah di-void dan tidak dapat diubah.",
      409,
    );
    return { id: entry.id, replayed: true };
  }
  ensure(
    period.status !== "draft",
    "Periode draf tidak menerima koreksi transaksi.",
  );
  const net = await netBalance(tx, r.id);
  const next =
    net +
    (entry.entryType === "deposit"
      ? -Number(entry.amount)
      : Number(entry.amount));
  ensure(
    next >= 0,
    "Void ditolak karena setoran bersih akan menjadi negatif. Koreksi transaksi pengembalian terlebih dahulu.",
  );
  ensure(
    r.status === "active" || next === 0,
    "Void akan mengubah saldo peserta yang telah dibatalkan. Buka kembali kepesertaan terlebih dahulu.",
  );
  await tx
    .update(cashTransactions)
    .set({ voidedAt: new Date(), voidedBy: actor, voidReason: v.reason })
    .where(and(eq(cashTransactions.id, entry.id)));
  if (group) await refreshReady(tx, group);
  await audit(
    tx,
    actor,
    "Transaksi di-void",
    "Keuangan",
    "cash_transaction",
    entry.id,
    period.id,
    `${entry.receiptNumber} · ${v.reason}`,
    { reason: v.reason, requestId: cmd.requestId },
  );
  return { id: entry.id };
}
