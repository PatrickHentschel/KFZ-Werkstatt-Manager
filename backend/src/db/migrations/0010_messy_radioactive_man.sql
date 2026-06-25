ALTER TABLE "invoices" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "issue_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "next_pickerl_date";
