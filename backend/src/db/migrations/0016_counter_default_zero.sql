-- Counter-Off-by-One: Default war 1, erste Nummer wurde dadurch 00002 statt 00001.
-- Fix: Default auf 0. Counter zählt nun die LETZTE vergebene Nummer.
-- Existing Tenants: nur zurücksetzen, wenn der Counter noch unberührt (= 1) ist.

ALTER TABLE "tenants" ALTER COLUMN "invoice_counter" SET DEFAULT 0;
ALTER TABLE "tenants" ALTER COLUMN "cancel_invoice_counter" SET DEFAULT 0;

-- Reset nur für unbenutzte Counter (kein Risiko bestehende Sequenzen zu brechen).
UPDATE "tenants" SET "invoice_counter" = 0 WHERE "invoice_counter" = 1;
UPDATE "tenants" SET "cancel_invoice_counter" = 0 WHERE "cancel_invoice_counter" = 1;
