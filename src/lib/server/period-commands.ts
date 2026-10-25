import "server-only";
import { eq, sql } from "drizzle-orm";
import {
  cashTransactions,
  qurbanGroups,
  qurbanPeriods,
  qurbanRegistrations,
} from "@/db/schema";
import { ensure } from "./errors";
import { schemas, type Command } from "./validation";
import { audit, lockPeriod, target, validId, type Tx } from "./transaction";

export async function periodCommand(tx: Tx, actor: string, cmd: Command) {
  if (cmd.action === "period.save") {
    const v = schemas.period.parse(cmd.values);
    ensure(
      v.start <= v.end && v.end <= v.due && v.due <= v.date,
      "Urutan tanggal: awal pendaftaran ≤ akhir pendaftaran ≤ pelunasan ≤ pelaksanaan.",
    );
    const values = {
      name: v.name,
      hijriYear: v.year,
      registrationStartsOn: v.start,
      registrationEndsOn: v.end,
      paymentDueOn: v.due,
      qurbanOn: v.date,
      notes: v.notes,
    };
    let id: string;
    if (cmd.id) {
      const p = await lockPeriod(tx, cmd.id);
      const [registration] = await tx
        .select({ id: qurbanRegistrations.id })
        .from(qurbanRegistrations)
        .where(eq(qurbanRegistrations.periodId, p.id))
        .limit(1);
      ensure(
        !registration || p.hijriYear === v.year,
        "Tahun tidak dapat diubah setelah ada kepesertaan.",
      );
      const changed =
        p.registrationStartsOn !== v.start ||
        p.registrationEndsOn !== v.end ||
        p.paymentDueOn !== v.due ||
        p.qurbanOn !== v.date;
      if (changed) schemas.reason.parse({ reason: cmd.values.reason });
      await tx
        .update(qurbanPeriods)
        .set(values)
        .where(eq(qurbanPeriods.id, p.id));
      id = p.id;
      await audit(
        tx,
        actor,
        "Periode diperbarui",
        "Periode",
        "period",
        id,
        id,
        v.name,
        {
          previous: {
            start: p.registrationStartsOn,
            end: p.registrationEndsOn,
            due: p.paymentDueOn,
            date: p.qurbanOn,
          },
          schedule: { start: v.start, end: v.end, due: v.due, date: v.date },
          reason: changed ? String(cmd.values.reason) : "",
        },
      );
    } else {
      const [p] = await tx
        .insert(qurbanPeriods)
        .values({ ...values, createdBy: actor })
        .returning({ id: qurbanPeriods.id });
      id = p.id;
      await audit(
        tx,
        actor,
        "Periode dibuat",
        "Periode",
        "period",
        id,
        id,
        v.name,
      );
    }
    return { id };
  }
  if (cmd.action === "period.feature") {
    const v = schemas.feature.parse(cmd.values);
    // Global serialization before row locks also protects the unique featured index.
    await tx.execute(sql`select pg_advisory_xact_lock(81448002)`);
    const p = await lockPeriod(tx, validId(cmd.id), false);
    ensure(
      p.status !== "draft",
      "Periode draf belum boleh ditampilkan di publik.",
    );
    await tx
      .update(qurbanPeriods)
      .set({ isFeatured: false })
      .where(eq(qurbanPeriods.isFeatured, true));
    if (!v.remove)
      await tx
        .update(qurbanPeriods)
        .set({ isFeatured: true })
        .where(eq(qurbanPeriods.id, p.id));
    await audit(
      tx,
      actor,
      v.remove ? "Sorotan publik dinonaktifkan" : "Sorotan publik diperbarui",
      "Periode",
      "period",
      p.id,
      p.id,
      p.name,
    );
    return { id: p.id };
  }
  const v = schemas.transition.parse(cmd.values);
  const p = await lockPeriod(tx, validId(cmd.id), false);
  const allowed: Record<string, string[]> = {
    draft: ["open"],
    open: ["closed"],
    closed: ["open", "completed"],
    completed: ["archived", "closed"],
    archived: ["closed"],
  };
  ensure(
    allowed[p.status].includes(v.status),
    "Perubahan status periode tidak diperbolehkan.",
  );
  if (v.status === "completed") {
    const groups = await tx
      .select()
      .from(qurbanGroups)
      .where(eq(qurbanGroups.periodId, p.id));
    ensure(
      groups.every((g) => ["slaughtered", "cancelled"].includes(g.status)),
      "Selesaikan atau batalkan seluruh kelompok sebelum menyelesaikan periode.",
    );
    const registrations = await tx
      .select({
        id: qurbanRegistrations.id,
        status: qurbanRegistrations.status,
        groupId: qurbanRegistrations.groupId,
        net: sql<string>`coalesce(sum(case when ${cashTransactions.voidedAt} is not null then 0 when ${cashTransactions.entryType} = 'deposit' then ${cashTransactions.amount} else -${cashTransactions.amount} end), 0)`,
      })
      .from(qurbanRegistrations)
      .leftJoin(
        cashTransactions,
        eq(cashTransactions.registrationId, qurbanRegistrations.id),
      )
      .where(eq(qurbanRegistrations.periodId, p.id))
      .groupBy(qurbanRegistrations.id);
    ensure(
      !registrations.some((r) => r.status === "active" && !r.groupId),
      "Selesaikan daftar tunggu terlebih dahulu.",
    );
    for (const g of groups) {
      const members = registrations.filter((r) => r.groupId === g.id);
      ensure(
        g.status === "cancelled" ||
          members.filter((r) => r.status === "active").length ===
            g.expectedMembers,
        "Jumlah anggota akhir belum sesuai kesepakatan.",
      );
      ensure(
        members.every(
          (m) =>
            Number(m.net) ===
            (m.status === "active" && g.status !== "cancelled" ? target(g) : 0),
        ),
        "Masih ada kewajiban atau kelebihan setoran yang belum selesai.",
      );
    }
    for (const r of registrations.filter(
      (r) => r.status === "cancelled" && !r.groupId,
    ))
      ensure(Number(r.net) === 0, "Peserta batal masih memiliki saldo.");
  }
  await tx
    .update(qurbanPeriods)
    .set({ status: v.status })
    .where(eq(qurbanPeriods.id, p.id));
  await audit(
    tx,
    actor,
    ["completed", "archived"].includes(p.status)
      ? "Periode dibuka kembali"
      : "Status periode diperbarui",
    "Periode",
    "period",
    p.id,
    p.id,
    `${p.name} · ${v.reason}`,
    { before: p.status, after: v.status, reason: v.reason },
  );
  return { id: p.id };
}
