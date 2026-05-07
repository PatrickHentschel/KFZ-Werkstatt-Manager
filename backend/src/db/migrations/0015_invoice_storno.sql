-- Storno-Rechnungen: eigener Nummernkreis ST-XXXXX, Verweis auf Original

ALTER TABLE "tenants" ADD COLUMN "cancel_invoice_prefix" varchar(20) NOT NULL DEFAULT 'ST';
ALTER TABLE "tenants" ADD COLUMN "cancel_invoice_counter" integer NOT NULL DEFAULT 1;

ALTER TABLE "invoices" ADD COLUMN "cancels_invoice_id" uuid REFERENCES "invoices"("id");
