CREATE TYPE "public"."cash_entry_type" AS ENUM('deposit', 'refund');--> statement-breakpoint
CREATE TYPE "public"."qurban_group_status" AS ENUM('forming', 'collecting', 'ready', 'purchased', 'slaughtered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."qurban_period_status" AS ENUM('draft', 'open', 'closed', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."qurban_registration_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"period_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_identifiers_not_blank" CHECK (btrim("audit_logs"."action") <> '' AND btrim("audit_logs"."entity_type") <> ''
        AND btrim("audit_logs"."entity_id") <> '')
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"entry_type" "cash_entry_type" NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"receipt_number" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"transacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text NOT NULL,
	"notes" text,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_transactions_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "cash_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "cash_transactions_amount_positive" CHECK ("cash_transactions"."amount" > 0),
	CONSTRAINT "cash_transactions_cash_only" CHECK ("cash_transactions"."payment_method" = 'cash'),
	CONSTRAINT "cash_transactions_receipt_not_blank" CHECK (btrim("cash_transactions"."receipt_number") <> ''),
	CONSTRAINT "cash_transactions_void_complete" CHECK (("cash_transactions"."voided_at" IS NULL AND "cash_transactions"."voided_by" IS NULL AND "cash_transactions"."void_reason" IS NULL)
        OR ("cash_transactions"."voided_at" IS NOT NULL AND "cash_transactions"."voided_by" IS NOT NULL
          AND "cash_transactions"."void_reason" IS NOT NULL AND btrim("cash_transactions"."void_reason") <> ''))
);
--> statement-breakpoint
CREATE TABLE "committee_admins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_name_not_blank" CHECK (btrim("participants"."full_name") <> ''),
	CONSTRAINT "participants_phone_format" CHECK ("participants"."phone" ~ '^\+?[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "qurban_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expected_members" integer DEFAULT 7 NOT NULL,
	"estimated_total" numeric(14, 0) NOT NULL,
	"final_total" numeric(14, 0),
	"price_locked_at" timestamp with time zone,
	"status" "qurban_group_status" DEFAULT 'forming' NOT NULL,
	"purchase_cost" numeric(14, 0),
	"purchased_at" timestamp with time zone,
	"slaughtered_at" timestamp with time zone,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qurban_groups_period_code_unique" UNIQUE("period_id","code"),
	CONSTRAINT "qurban_groups_id_period_unique" UNIQUE("id","period_id"),
	CONSTRAINT "qurban_groups_code_not_blank" CHECK (btrim("qurban_groups"."code") <> ''),
	CONSTRAINT "qurban_groups_member_limit" CHECK ("qurban_groups"."expected_members" BETWEEN 1 AND 7),
	CONSTRAINT "qurban_groups_costs_positive" CHECK ("qurban_groups"."estimated_total" > 0
        AND ("qurban_groups"."final_total" IS NULL OR "qurban_groups"."final_total" > 0)
        AND ("qurban_groups"."purchase_cost" IS NULL OR "qurban_groups"."purchase_cost" > 0)),
	CONSTRAINT "qurban_groups_price_lock_complete" CHECK (("qurban_groups"."final_total" IS NULL) = ("qurban_groups"."price_locked_at" IS NULL)),
	CONSTRAINT "qurban_groups_ready_price_locked" CHECK ("qurban_groups"."status" NOT IN ('ready', 'purchased', 'slaughtered')
        OR "qurban_groups"."final_total" IS NOT NULL),
	CONSTRAINT "qurban_groups_purchase_complete" CHECK (("qurban_groups"."purchase_cost" IS NULL) = ("qurban_groups"."purchased_at" IS NULL)),
	CONSTRAINT "qurban_groups_purchased_has_receipt" CHECK ("qurban_groups"."status" NOT IN ('purchased', 'slaughtered')
        OR "qurban_groups"."purchased_at" IS NOT NULL),
	CONSTRAINT "qurban_groups_slaughter_status_matches" CHECK (("qurban_groups"."status" = 'slaughtered') = ("qurban_groups"."slaughtered_at" IS NOT NULL)),
	CONSTRAINT "qurban_groups_slaughter_after_purchase" CHECK ("qurban_groups"."slaughtered_at" IS NULL OR "qurban_groups"."slaughtered_at" >= "qurban_groups"."purchased_at")
);
--> statement-breakpoint
CREATE TABLE "qurban_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hijri_year" integer NOT NULL,
	"registration_starts_on" date NOT NULL,
	"registration_ends_on" date NOT NULL,
	"payment_due_on" date NOT NULL,
	"qurban_on" date NOT NULL,
	"status" "qurban_period_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qurban_periods_hijri_year_unique" UNIQUE("hijri_year"),
	CONSTRAINT "qurban_periods_name_not_blank" CHECK (btrim("qurban_periods"."name") <> ''),
	CONSTRAINT "qurban_periods_hijri_year_positive" CHECK ("qurban_periods"."hijri_year" > 0),
	CONSTRAINT "qurban_periods_dates_ordered" CHECK ("qurban_periods"."registration_starts_on" <= "qurban_periods"."registration_ends_on"
        AND "qurban_periods"."registration_ends_on" <= "qurban_periods"."payment_due_on"
        AND "qurban_periods"."payment_due_on" <= "qurban_periods"."qurban_on"),
	CONSTRAINT "qurban_periods_featured_is_published" CHECK (NOT "qurban_periods"."is_featured" OR "qurban_periods"."status" <> 'draft')
);
--> statement-breakpoint
CREATE TABLE "qurban_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"registration_number" text NOT NULL,
	"qurban_name" text NOT NULL,
	"group_id" uuid,
	"slot_number" integer,
	"status" "qurban_registration_status" DEFAULT 'active' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancellation_reason" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qurban_registrations_person_period_unique" UNIQUE("participant_id","period_id"),
	CONSTRAINT "qurban_registrations_number_period_unique" UNIQUE("period_id","registration_number"),
	CONSTRAINT "qurban_registrations_names_not_blank" CHECK (btrim("qurban_registrations"."registration_number") <> '' AND btrim("qurban_registrations"."qurban_name") <> ''),
	CONSTRAINT "qurban_registrations_group_slot_pair" CHECK (("qurban_registrations"."group_id" IS NULL) = ("qurban_registrations"."slot_number" IS NULL)),
	CONSTRAINT "qurban_registrations_slot_range" CHECK ("qurban_registrations"."slot_number" IS NULL OR "qurban_registrations"."slot_number" BETWEEN 1 AND 7),
	CONSTRAINT "qurban_registrations_cancellation_complete" CHECK (("qurban_registrations"."status" = 'active' AND "qurban_registrations"."cancelled_at" IS NULL
          AND "qurban_registrations"."cancelled_by" IS NULL AND "qurban_registrations"."cancellation_reason" IS NULL)
        OR ("qurban_registrations"."status" = 'cancelled' AND "qurban_registrations"."cancelled_at" IS NOT NULL
          AND "qurban_registrations"."cancelled_by" IS NOT NULL AND "qurban_registrations"."cancellation_reason" IS NOT NULL
          AND btrim("qurban_registrations"."cancellation_reason") <> ''))
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"committee_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"public_description" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_whatsapp_format" CHECK ("site_settings"."whatsapp_number" ~ '^[1-9][0-9]{7,14}$'),
	CONSTRAINT "site_settings_names_not_blank" CHECK (btrim("site_settings"."committee_name") <> '' AND btrim("site_settings"."contact_name") <> '')
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_committee_admins_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_period_id_qurban_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."qurban_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_registration_id_qurban_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."qurban_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_recorded_by_committee_admins_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_voided_by_committee_admins_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_admins" ADD CONSTRAINT "committee_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_admins" ADD CONSTRAINT "committee_admins_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_created_by_committee_admins_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_groups" ADD CONSTRAINT "qurban_groups_period_id_qurban_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."qurban_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_groups" ADD CONSTRAINT "qurban_groups_created_by_committee_admins_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_periods" ADD CONSTRAINT "qurban_periods_created_by_committee_admins_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_registrations" ADD CONSTRAINT "qurban_registrations_period_id_qurban_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."qurban_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_registrations" ADD CONSTRAINT "qurban_registrations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_registrations" ADD CONSTRAINT "qurban_registrations_cancelled_by_committee_admins_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_registrations" ADD CONSTRAINT "qurban_registrations_created_by_committee_admins_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qurban_registrations" ADD CONSTRAINT "qurban_registrations_group_period_fk" FOREIGN KEY ("group_id","period_id") REFERENCES "public"."qurban_groups"("id","period_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_committee_admins_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."committee_admins"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_period_date_idx" ON "audit_logs" USING btree ("period_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "cash_transactions_registration_date_idx" ON "cash_transactions" USING btree ("registration_id","transacted_at");--> statement-breakpoint
CREATE INDEX "cash_transactions_recorded_by_idx" ON "cash_transactions" USING btree ("recorded_by");--> statement-breakpoint
CREATE INDEX "cash_transactions_voided_by_idx" ON "cash_transactions" USING btree ("voided_by");--> statement-breakpoint
CREATE INDEX "committee_admins_created_by_idx" ON "committee_admins" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "participants_phone_idx" ON "participants" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "participants_created_by_idx" ON "participants" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "qurban_groups_period_status_idx" ON "qurban_groups" USING btree ("period_id","status");--> statement-breakpoint
CREATE INDEX "qurban_groups_created_by_idx" ON "qurban_groups" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "qurban_periods_one_featured_idx" ON "qurban_periods" USING btree ("is_featured") WHERE "qurban_periods"."is_featured" = true;--> statement-breakpoint
CREATE INDEX "qurban_periods_status_idx" ON "qurban_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qurban_periods_created_by_idx" ON "qurban_periods" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "qurban_registrations_active_slot_unique" ON "qurban_registrations" USING btree ("group_id","slot_number") WHERE "qurban_registrations"."status" = 'active' AND "qurban_registrations"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "qurban_registrations_period_status_idx" ON "qurban_registrations" USING btree ("period_id","status");--> statement-breakpoint
CREATE INDEX "qurban_registrations_group_period_idx" ON "qurban_registrations" USING btree ("group_id","period_id");--> statement-breakpoint
CREATE INDEX "qurban_registrations_created_by_idx" ON "qurban_registrations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "qurban_registrations_cancelled_by_idx" ON "qurban_registrations" USING btree ("cancelled_by");--> statement-breakpoint
CREATE INDEX "site_settings_updated_by_idx" ON "site_settings" USING btree ("updated_by");