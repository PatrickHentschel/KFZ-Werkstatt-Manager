-- Add AW (Arbeitswert) support: aw_rate per staff member, unit column on line items, configurable minutes per AW on tenant
ALTER TABLE "staff" ADD COLUMN "aw_rate" numeric(10, 2);
ALTER TABLE "order_items" ADD COLUMN "unit" varchar(10);
ALTER TABLE "invoice_items" ADD COLUMN "unit" varchar(10);
ALTER TABLE "tenants" ADD COLUMN "aw_minutes" integer NOT NULL DEFAULT 5;
