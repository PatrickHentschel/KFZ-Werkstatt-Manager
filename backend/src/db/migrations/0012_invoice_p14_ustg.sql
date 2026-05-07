-- Phase 2: §14 UStG Pflichtfelder + Skonto + Per-Item-Rabatt

ALTER TABLE "invoices" ADD COLUMN "service_date" date;
ALTER TABLE "invoices" ADD COLUMN "skonto_percent" numeric(5, 2);
ALTER TABLE "invoices" ADD COLUMN "skonto_days" integer;

ALTER TABLE "invoice_items" ADD COLUMN "service_date" date;
ALTER TABLE "invoice_items" ADD COLUMN "discount_amount" numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "invoice_items" ADD COLUMN "discount_percent" numeric(5, 2) NOT NULL DEFAULT 0;
