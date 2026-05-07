-- Phase 1: DE market readiness — locale defaults, banking fields, small-business flag
-- Schema deltas only. No data migration (dev only).

ALTER TABLE "tenants" ADD COLUMN "postal_code" varchar(10);
ALTER TABLE "tenants" ADD COLUMN "is_small_business" boolean NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "iban" varchar(34);
ALTER TABLE "tenants" ADD COLUMN "bic" varchar(11);
ALTER TABLE "tenants" ADD COLUMN "bank_name" varchar(255);

ALTER TABLE "tenants" ALTER COLUMN "tax_rate" SET DEFAULT '19.00';
ALTER TABLE "invoice_items" ALTER COLUMN "tax_rate" SET DEFAULT '19.00';
ALTER TABLE "order_items" ALTER COLUMN "tax_rate" SET DEFAULT '19.00';
