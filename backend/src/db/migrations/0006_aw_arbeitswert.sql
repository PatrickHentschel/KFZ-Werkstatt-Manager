-- Add AW (Arbeitswert) support: aw_rate per staff member, unit column on line items
ALTER TABLE "staff" ADD COLUMN "aw_rate" numeric(10, 2);
ALTER TABLE "order_items" ADD COLUMN "unit" varchar(10);
ALTER TABLE "invoice_items" ADD COLUMN "unit" varchar(10);
