import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, cashTransactions, qurbanRegistrations } from "@/db/schema";
import { ensure } from "./errors";
import { schemas, type Command } from "./validation";
import {
  audit,
  lockGroups,
  lockPeriod,
  refreshReady,
  type Tx,
} from "./transaction";
import { cashCommand } from "./cash-commands";

export async function correctionCommand(tx: Tx, actor: string, cmd: Command) {
  const v = schemas.correction.parse(cmd.values);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        ids: [...v.ids].sort(),
        reason: v.reason,
        replacement: v.replacement ?? null,
      }),
    )
    .digest("hex");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${cmd.requestId}, 81449))`,
  );
  const [saved] = await tx
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "cash_correction"),
        eq(auditLogs.entityId, cmd.requestId),
      ),
    );
  if (saved) {
    ensure(
      saved.actorId === actor && saved.metadata?.fingerprint === fingerprint,
      "Kunci koreksi telah digunakan untuk rincian lain.",
      409,
    );
    return { id: cmd.requestId, replayed: true };
  }
  const entries = await tx
    .select()
    .from(cashTransactions)
    .where(inArray(cashTransactions.id, v.ids));
  ensure(
    entries.length === v.ids.length,
    "Salah satu transaksi koreksi tidak ditemukan.",
    404,
  );
  const registrationIds = [
    ...new Set([
      ...entries.map((entry) => entry.registrationId),
      ...(v.replacement ? [v.replacement.participant] : []),
    ]),
  ].sort();
  const found = await tx
    .select()
    .from(qurbanRegistrations)
    .where(inArray(qurbanRegistrations.id, registrationIds));
  ensure(
    found.length === registrationIds.length &&
      found.every((r) => r.periodId === found[0].periodId),
    "Koreksi harus menggunakan peserta dari satu periode yang sama.",
  );
  ensure(
    !cmd.periodId || cmd.periodId === found[0].periodId,
    "Periode koreksi tidak sesuai.",
  );
  const period = await lockPeriod(tx, found[0].periodId);
  const [usedKey] = await tx
    .select({ id: cashTransactions.id })
    .from(cashTransactions)
    .where(eq(cashTransactions.idempotencyKey, cmd.requestId));
  ensure(!usedKey, "Kunci koreksi sudah digunakan untuk transaksi lain.", 409);
  ensure(period.status !== "draft", "Periode draf tidak menerima koreksi.");
  const current = await tx
    .select()
    .from(qurbanRegistrations)
    .where(inArray(qurbanRegistrations.id, registrationIds));
  const groups = await lockGroups(
    tx,
    current.map((r) => r.groupId),
  );
  const registrations = await tx
    .select()
    .from(qurbanRegistrations)
    .where(inArray(qurbanRegistrations.id, registrationIds))
    .orderBy(asc(qurbanRegistrations.id))
    .for("update");
  const lockedEntries = await tx
    .select()
    .from(cashTransactions)
    .where(inArray(cashTransactions.id, v.ids))
    .orderBy(asc(cashTransactions.id))
    .for("update");
  ensure(
    lockedEntries.every((entry) => !entry.voidedAt),
    "Transaksi yang sudah di-void tidak dapat dikoreksi kembali.",
    409,
  );
  await tx
    .update(cashTransactions)
    .set({ voidedAt: new Date(), voidedBy: actor, voidReason: v.reason })
    .where(inArray(cashTransactions.id, v.ids));
  let replacementId: string | null = null;
  if (v.replacement) {
    const result = await cashCommand(tx, actor, {
      ...cmd,
      action: "cash.create",
      periodId: period.id,
      values: v.replacement,
    });
    replacementId = result.id;
  }
  const balances = await tx
    .select({
      id: cashTransactions.registrationId,
      net: sql<string>`sum(case when ${cashTransactions.voidedAt} is not null then 0 when ${cashTransactions.entryType} = 'deposit' then ${cashTransactions.amount} else -${cashTransactions.amount} end)`,
    })
    .from(cashTransactions)
    .where(inArray(cashTransactions.registrationId, registrationIds))
    .groupBy(cashTransactions.registrationId);
  const net = new Map(balances.map((row) => [row.id, Number(row.net)]));
  ensure(
    registrations.every(
      (r) =>
        (net.get(r.id) ?? 0) >= 0 &&
        (r.status === "active" || (net.get(r.id) ?? 0) === 0),
    ),
    "Koreksi menghasilkan saldo negatif atau mengubah saldo kepesertaan batal.",
  );
  for (const group of groups) await refreshReady(tx, group);
  await audit(
    tx,
    actor,
    "Transaksi dikoreksi",
    "Keuangan",
    "cash_correction",
    cmd.requestId,
    period.id,
    `${v.ids.length} transaksi di-void · ${v.reason}`,
    { fingerprint, voidedIds: v.ids, replacementId, reason: v.reason },
  );
  return { id: cmd.requestId, replacementId };
}
