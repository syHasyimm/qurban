import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  cashTransactions,
  committeeAdmins,
  participants,
  qurbanGroups,
  qurbanPeriods,
  qurbanRegistrations,
  siteSettings,
  user,
} from "@/db/schema";
import {
  money,
  dateLabel,
  groupLabels,
  periodLabels,
  type DemoState,
  type Period,
  type SiteSettings,
} from "@/lib/qurban-demo";
import { ensure } from "./errors";

export const emptySettings: SiteSettings = {
  name: "Panitia Qurban",
  contact: "Panitia",
  whatsapp: "",
  description:
    "Wujudkan niat berqurban bersama. Hubungi panitia untuk informasi program dan pendaftaran peserta.",
  address: "",
};
const dateKey = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(value)
    : "";

function auditChanges(metadata: Record<string, unknown> | null): string[] {
  const labels: Record<string, string> = {
    expectedMembers: "Jumlah anggota",
    estimatedTotal: "Estimasi biaya",
    finalTotal: "Total biaya final",
    purchaseCost: "Harga beli",
    status: "Status",
    start: "Awal pendaftaran",
    end: "Akhir pendaftaran",
    due: "Batas pelunasan",
    date: "Pelaksanaan",
    purchasedAt: "Tanggal pembelian",
    slaughteredAt: "Tanggal qurban",
  };
  const before = metadata?.previous ?? metadata?.before;
  const after = metadata?.schedule ?? metadata?.after;
  const format = (key: string, value: unknown) =>
    value === null || value === undefined
      ? "Belum ditentukan"
      : ["estimatedTotal", "finalTotal", "purchaseCost"].includes(key)
        ? money(Number(value))
        : key === "status"
          ? (({ ...groupLabels, ...periodLabels } as Record<string, string>)[
              String(value)
            ] ?? String(value))
          : [
                "start",
                "end",
                "due",
                "date",
                "purchasedAt",
                "slaughteredAt",
              ].includes(key)
            ? dateLabel(String(value))
            : String(value);
  if (
    typeof before === "string" &&
    typeof after === "string" &&
    before in periodLabels &&
    after in periodLabels
  )
    return [`Status: ${format("status", before)} → ${format("status", after)}`];
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object"
  )
    return [];
  const oldValues = before as Record<string, unknown>;
  const newValues = after as Record<string, unknown>;
  return Object.keys(newValues)
    .filter((key) => labels[key] && oldValues[key] !== newValues[key])
    .map(
      (key) =>
        `${labels[key]}: ${format(key, oldValues[key])} → ${format(key, newValues[key])}`,
    );
}
export async function loadState(actorId: string): Promise<DemoState> {
  return db.transaction(
    async (tx) => {
      const [admin] = await tx
        .select({ active: committeeAdmins.isActive })
        .from(committeeAdmins)
        .where(eq(committeeAdmins.userId, actorId));
      ensure(admin?.active, "Akses panitia sudah tidak aktif.", 403);
      const [
        periods,
        groups,
        registrations,
        entries,
        accounts,
        activities,
        settings,
        people,
      ] = await Promise.all([
        tx.select().from(qurbanPeriods).orderBy(desc(qurbanPeriods.hijriYear)),
        tx.select().from(qurbanGroups).orderBy(asc(qurbanGroups.code)),
        tx
          .select({ registration: qurbanRegistrations, person: participants })
          .from(qurbanRegistrations)
          .innerJoin(
            participants,
            eq(participants.id, qurbanRegistrations.participantId),
          )
          .orderBy(asc(qurbanRegistrations.registeredAt)),
        tx
          .select({ entry: cashTransactions, officer: user.name })
          .from(cashTransactions)
          .innerJoin(user, eq(user.id, cashTransactions.recordedBy))
          .orderBy(
            desc(cashTransactions.transactedAt),
            desc(cashTransactions.createdAt),
          ),
        tx
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            active: committeeAdmins.isActive,
            created: committeeAdmins.createdAt,
          })
          .from(committeeAdmins)
          .innerJoin(user, eq(user.id, committeeAdmins.userId))
          .orderBy(asc(committeeAdmins.createdAt)),
        tx
          .select({ log: auditLogs, actor: user.name })
          .from(auditLogs)
          .innerJoin(user, eq(user.id, auditLogs.actorId))
          .orderBy(desc(auditLogs.createdAt)),
        tx
          .select({
            name: siteSettings.committeeName,
            contact: siteSettings.contactName,
            whatsapp: siteSettings.whatsappNumber,
            description: siteSettings.publicDescription,
            address: siteSettings.address,
          })
          .from(siteSettings)
          .where(eq(siteSettings.id, 1)),
        tx
          .select({
            id: participants.id,
            name: participants.fullName,
            phone: participants.phone,
            address: participants.address,
          })
          .from(participants)
          .orderBy(asc(participants.fullName)),
      ]);
      return {
        periods: periods.map((p) => ({
          id: p.id,
          name: p.name,
          year: p.hijriYear,
          start: p.registrationStartsOn,
          end: p.registrationEndsOn,
          due: p.paymentDueOn,
          date: p.qurbanOn,
          status: p.status,
          featured: p.isFeatured,
          notes: p.notes ?? "",
        })),
        groups: groups.map((g) => ({
          id: g.id,
          periodId: g.periodId,
          name: g.code,
          breed: g.breed,
          expected: g.expectedMembers,
          estimate: Number(g.estimatedTotal),
          final: Number(g.finalTotal ?? 0),
          locked: !!g.priceLockedAt,
          status: g.status,
          purchaseCost: Number(g.purchaseCost ?? 0),
          purchasedOn: dateKey(g.purchasedAt),
          slaughteredOn: dateKey(g.slaughteredAt),
          notes: g.notes ?? "",
        })),
        participants: registrations.map(({ registration: r, person: p }) => ({
          id: r.id,
          participantId: p.id,
          number: r.registrationNumber,
          name: r.qurbanName,
          phone: p.phone,
          address: p.address ?? "",
          periodId: r.periodId,
          groupId: r.groupId ?? "",
          active: r.status === "active",
          notes: r.notes ?? p.notes ?? "",
        })),
        transactions: entries.map(({ entry: e, officer }) => ({
          id: e.id,
          receipt: e.receiptNumber,
          participantId: e.registrationId,
          type: e.entryType,
          amount: Number(e.amount),
          date: dateKey(e.transactedAt),
          time: new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(e.transactedAt),
          officer,
          notes: e.notes ?? "",
          voidReason: e.voidReason ?? "",
        })),
        accounts: accounts
          .sort((a, b) => Number(b.id === actorId) - Number(a.id === actorId))
          .map((a) => ({ ...a, created: dateKey(a.created) })),
        activities: activities.map(({ log: a, actor }) => ({
          id: a.id,
          action: a.action,
          detail: String(a.metadata?.detail ?? a.entityId),
          actor,
          date: a.createdAt.toISOString(),
          periodId: a.periodId ?? "",
          category: String(a.metadata?.category ?? "Pengaturan"),
          changes: auditChanges(a.metadata),
        })),
        settings: settings[0] ?? emptySettings,
        directory: people.map((p) => ({ ...p, address: p.address ?? "" })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function loadPublicData() {
  return db.transaction(
    async (tx) => {
      const [settings] = await tx
        .select({
          name: siteSettings.committeeName,
          contact: siteSettings.contactName,
          whatsapp: siteSettings.whatsappNumber,
          description: siteSettings.publicDescription,
          address: siteSettings.address,
        })
        .from(siteSettings)
        .where(eq(siteSettings.id, 1));
      const [p] = await tx
        .select({
          id: qurbanPeriods.id,
          name: qurbanPeriods.name,
          year: qurbanPeriods.hijriYear,
          start: qurbanPeriods.registrationStartsOn,
          end: qurbanPeriods.registrationEndsOn,
          due: qurbanPeriods.paymentDueOn,
          date: qurbanPeriods.qurbanOn,
          status: qurbanPeriods.status,
          featured: qurbanPeriods.isFeatured,
        })
        .from(qurbanPeriods)
        .where(eq(qurbanPeriods.isFeatured, true));
      const period: Period | null =
        p && p.status !== "draft" ? { ...p, notes: "" } : null;
      if (!period)
        return { settings: settings ?? emptySettings, period, aggregate: null };
      const rows = await tx.execute<{
        registered: number;
        grouped: number;
        planned: number;
        funded: number;
        purchased: number;
        slaughtered: number;
      }>(sql`
      select
        (select count(*)::int from qurban_registrations r where r.period_id = ${period.id} and r.status = 'active') as registered,
        (select count(*)::int from qurban_registrations r join qurban_groups g on g.id = r.group_id where r.period_id = ${period.id} and r.status = 'active' and g.status <> 'cancelled') as grouped,
        count(*)::int as planned,
        count(*) filter (where g.status in ('ready', 'purchased', 'slaughtered'))::int as funded,
        count(*) filter (where g.status in ('purchased', 'slaughtered'))::int as purchased,
        count(*) filter (where g.status = 'slaughtered')::int as slaughtered
      from qurban_groups g where g.period_id = ${period.id} and g.status <> 'cancelled'
        and exists (select 1 from qurban_registrations r where r.group_id = g.id and r.status = 'active')
    `);
      return {
        settings: settings ?? emptySettings,
        period,
        aggregate: rows[0],
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
