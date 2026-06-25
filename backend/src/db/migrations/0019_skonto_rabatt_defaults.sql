-- Skonto und Rabatt: einheitlich Default 0 (statt nullable). Render-Logik
-- blendet sie bei 0 ohnehin aus — semantisch identisch, aber Schema sauberer.
-- Aufträge bekommen die Felder neu, damit sie beim Promote in eine Rechnung
-- nicht verloren gehen.

-- ── invoices: nullable → notNull DEFAULT 0 ────────────────────────────────
UPDATE "invoices" SET "skonto_percent" = 0 WHERE "skonto_percent" IS NULL;
UPDATE "invoices" SET "skonto_days"    = 0 WHERE "skonto_days"    IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "skonto_percent" SET DEFAULT 0;
ALTER TABLE "invoices" ALTER COLUMN "skonto_percent" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "skonto_days"    SET DEFAULT 0;
ALTER TABLE "invoices" ALTER COLUMN "skonto_days"    SET NOT NULL;

-- ── orders: Skonto-Felder neu ─────────────────────────────────────────────
ALTER TABLE "orders" ADD COLUMN "skonto_percent" decimal(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "skonto_days"    integer      NOT NULL DEFAULT 0;

-- ── order_items: Rabatt-Felder neu ────────────────────────────────────────
ALTER TABLE "order_items" ADD COLUMN "discount_amount"  decimal(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "discount_percent" decimal(5,2)  NOT NULL DEFAULT 0;
