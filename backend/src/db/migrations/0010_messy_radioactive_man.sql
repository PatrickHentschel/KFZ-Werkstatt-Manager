ALTER TYPE "fuel_type" ADD VALUE 'benzin';--> statement-breakpoint
ALTER TYPE "fuel_type" ADD VALUE 'elektro';--> statement-breakpoint
ALTER TYPE "fuel_type" ADD VALUE 'sonstige';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "issue_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "aw_minutes" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit" varchar(10);--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "type" "order_item_type" DEFAULT 'misc' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "unit_cost" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "unit" varchar(10);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_checkout_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "next_pickerl_date";