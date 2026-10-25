ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_whatsapp_format";--> statement-breakpoint
ALTER TABLE "qurban_groups" ADD COLUMN "breed" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_whatsapp_format" CHECK ("site_settings"."whatsapp_number" = '' OR "site_settings"."whatsapp_number" ~ '^[1-9][0-9]{7,14}$');