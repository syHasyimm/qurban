import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();
// Whole rupiah, returned as strings to preserve exact arithmetic.
const rupiah = (name: string) => numeric(name, { precision: 14, scale: 0 });

export const periodStatus = pgEnum("qurban_period_status", [
  "draft",
  "open",
  "closed",
  "completed",
  "archived",
]);
export const groupStatus = pgEnum("qurban_group_status", [
  "forming",
  "collecting",
  "ready",
  "purchased",
  "slaughtered",
  "cancelled",
]);
export const registrationStatus = pgEnum("qurban_registration_status", [
  "active",
  "cancelled",
]);
export const cashEntryType = pgEnum("cash_entry_type", ["deposit", "refund"]);

// An explicit allowlist, separate from generated Better Auth tables.
// Existing auth users are NOT automatically committee administrators.
export const committeeAdmins = pgTable(
  "committee_admins",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("committee_admins_created_by_idx").on(table.createdBy)],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    committeeName: text("committee_name").notNull(),
    contactName: text("contact_name").notNull(),
    whatsappNumber: text("whatsapp_number").notNull(),
    publicDescription: text("public_description").default("").notNull(),
    address: text("address").default("").notNull(),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("site_settings_singleton", sql`${table.id} = 1`),
    check(
      "site_settings_whatsapp_format",
      sql`${table.whatsappNumber} = '' OR ${table.whatsappNumber} ~ '^[1-9][0-9]{7,14}$'`,
    ),
    check(
      "site_settings_names_not_blank",
      sql`btrim(${table.committeeName}) <> '' AND btrim(${table.contactName}) <> ''`,
    ),
    index("site_settings_updated_by_idx").on(table.updatedBy),
  ],
);

export const qurbanPeriods = pgTable(
  "qurban_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    hijriYear: integer("hijri_year").notNull().unique(),
    registrationStartsOn: date("registration_starts_on").notNull(),
    registrationEndsOn: date("registration_ends_on").notNull(),
    paymentDueOn: date("payment_due_on").notNull(),
    qurbanOn: date("qurban_on").notNull(),
    status: periodStatus("status").default("draft").notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("qurban_periods_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("qurban_periods_hijri_year_positive", sql`${table.hijriYear} > 0`),
    check(
      "qurban_periods_dates_ordered",
      sql`${table.registrationStartsOn} <= ${table.registrationEndsOn}
        AND ${table.registrationEndsOn} <= ${table.paymentDueOn}
        AND ${table.paymentDueOn} <= ${table.qurbanOn}`,
    ),
    check(
      "qurban_periods_featured_is_published",
      sql`NOT ${table.isFeatured} OR ${table.status} <> 'draft'`,
    ),
    uniqueIndex("qurban_periods_one_featured_idx")
      .on(table.isFeatured)
      .where(sql`${table.isFeatured} = true`),
    index("qurban_periods_status_idx").on(table.status),
    index("qurban_periods_created_by_idx").on(table.createdBy),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("participants_name_not_blank", sql`btrim(${table.fullName}) <> ''`),
    check(
      "participants_phone_format",
      sql`${table.phone} ~ '^\\+?[1-9][0-9]{7,14}$'`,
    ),
    // Several family members may share a contact number.
    index("participants_phone_idx").on(table.phone),
    index("participants_created_by_idx").on(table.createdBy),
  ],
);

export const qurbanGroups = pgTable(
  "qurban_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => qurbanPeriods.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    breed: text("breed").default("").notNull(),
    expectedMembers: integer("expected_members").default(7).notNull(),
    estimatedTotal: rupiah("estimated_total").notNull(),
    finalTotal: rupiah("final_total"),
    priceLockedAt: timestamp("price_locked_at", { withTimezone: true }),
    status: groupStatus("status").default("forming").notNull(),
    purchaseCost: rupiah("purchase_cost"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    slaughteredAt: timestamp("slaughtered_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("qurban_groups_period_code_unique").on(table.periodId, table.code),
    // Referenced by the composite FK that prevents cross-period assignment.
    unique("qurban_groups_id_period_unique").on(table.id, table.periodId),
    check("qurban_groups_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check(
      "qurban_groups_member_limit",
      sql`${table.expectedMembers} BETWEEN 1 AND 7`,
    ),
    check(
      "qurban_groups_costs_positive",
      sql`${table.estimatedTotal} > 0
        AND (${table.finalTotal} IS NULL OR ${table.finalTotal} > 0)
        AND (${table.purchaseCost} IS NULL OR ${table.purchaseCost} > 0)`,
    ),
    check(
      "qurban_groups_price_lock_complete",
      sql`(${table.finalTotal} IS NULL) = (${table.priceLockedAt} IS NULL)`,
    ),
    check(
      "qurban_groups_ready_price_locked",
      sql`${table.status} NOT IN ('ready', 'purchased', 'slaughtered')
        OR ${table.finalTotal} IS NOT NULL`,
    ),
    check(
      "qurban_groups_purchase_complete",
      sql`(${table.purchaseCost} IS NULL) = (${table.purchasedAt} IS NULL)`,
    ),
    check(
      "qurban_groups_purchased_has_receipt",
      sql`${table.status} NOT IN ('purchased', 'slaughtered')
        OR ${table.purchasedAt} IS NOT NULL`,
    ),
    check(
      "qurban_groups_slaughter_status_matches",
      sql`(${table.status} = 'slaughtered') = (${table.slaughteredAt} IS NOT NULL)`,
    ),
    check(
      "qurban_groups_slaughter_after_purchase",
      sql`${table.slaughteredAt} IS NULL OR ${table.slaughteredAt} >= ${table.purchasedAt}`,
    ),
    index("qurban_groups_period_status_idx").on(table.periodId, table.status),
    index("qurban_groups_created_by_idx").on(table.createdBy),
  ],
);

export const qurbanRegistrations = pgTable(
  "qurban_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => qurbanPeriods.id, { onDelete: "restrict" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "restrict" }),
    registrationNumber: text("registration_number").notNull(),
    qurbanName: text("qurban_name").notNull(),
    groupId: uuid("group_id"),
    slotNumber: integer("slot_number"),
    status: registrationStatus("status").default("active").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").references(() => committeeAdmins.userId, {
      onDelete: "restrict",
    }),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("qurban_registrations_person_period_unique").on(
      table.participantId,
      table.periodId,
    ),
    unique("qurban_registrations_number_period_unique").on(
      table.periodId,
      table.registrationNumber,
    ),
    foreignKey({
      name: "qurban_registrations_group_period_fk",
      columns: [table.groupId, table.periodId],
      foreignColumns: [qurbanGroups.id, qurbanGroups.periodId],
    }).onDelete("restrict"),
    check(
      "qurban_registrations_names_not_blank",
      sql`btrim(${table.registrationNumber}) <> '' AND btrim(${table.qurbanName}) <> ''`,
    ),
    check(
      "qurban_registrations_group_slot_pair",
      sql`(${table.groupId} IS NULL) = (${table.slotNumber} IS NULL)`,
    ),
    check(
      "qurban_registrations_slot_range",
      sql`${table.slotNumber} IS NULL OR ${table.slotNumber} BETWEEN 1 AND 7`,
    ),
    check(
      "qurban_registrations_cancellation_complete",
      sql`(${table.status} = 'active' AND ${table.cancelledAt} IS NULL
          AND ${table.cancelledBy} IS NULL AND ${table.cancellationReason} IS NULL)
        OR (${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL
          AND ${table.cancelledBy} IS NOT NULL AND ${table.cancellationReason} IS NOT NULL
          AND btrim(${table.cancellationReason}) <> '')`,
    ),
    // Seven distinct slots + this index also protect concurrent assignments.
    uniqueIndex("qurban_registrations_active_slot_unique")
      .on(table.groupId, table.slotNumber)
      .where(sql`${table.status} = 'active' AND ${table.groupId} IS NOT NULL`),
    index("qurban_registrations_period_status_idx").on(
      table.periodId,
      table.status,
    ),
    index("qurban_registrations_group_period_idx").on(
      table.groupId,
      table.periodId,
    ),
    index("qurban_registrations_created_by_idx").on(table.createdBy),
    index("qurban_registrations_cancelled_by_idx").on(table.cancelledBy),
  ],
);

export const cashTransactions = pgTable(
  "cash_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => qurbanRegistrations.id, { onDelete: "restrict" }),
    entryType: cashEntryType("entry_type").notNull(),
    amount: rupiah("amount").notNull(),
    paymentMethod: text("payment_method").default("cash").notNull(),
    receiptNumber: text("receipt_number").notNull().unique(),
    // The caller must reuse this key when retrying the same submission.
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    transactedAt: timestamp("transacted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => committeeAdmins.userId, {
      onDelete: "restrict",
    }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (table) => [
    check("cash_transactions_amount_positive", sql`${table.amount} > 0`),
    check("cash_transactions_cash_only", sql`${table.paymentMethod} = 'cash'`),
    check(
      "cash_transactions_receipt_not_blank",
      sql`btrim(${table.receiptNumber}) <> ''`,
    ),
    check(
      "cash_transactions_void_complete",
      sql`(${table.voidedAt} IS NULL AND ${table.voidedBy} IS NULL AND ${table.voidReason} IS NULL)
        OR (${table.voidedAt} IS NOT NULL AND ${table.voidedBy} IS NOT NULL
          AND ${table.voidReason} IS NOT NULL AND btrim(${table.voidReason}) <> '')`,
    ),
    index("cash_transactions_registration_date_idx").on(
      table.registrationId,
      table.transactedAt,
    ),
    index("cash_transactions_recorded_by_idx").on(table.recordedBy),
    index("cash_transactions_voided_by_idx").on(table.voidedBy),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => committeeAdmins.userId, { onDelete: "restrict" }),
    periodId: uuid("period_id").references(() => qurbanPeriods.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [
    check(
      "audit_logs_identifiers_not_blank",
      sql`btrim(${table.action}) <> '' AND btrim(${table.entityType}) <> ''
        AND btrim(${table.entityId}) <> ''`,
    ),
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_period_date_idx").on(table.periodId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);
