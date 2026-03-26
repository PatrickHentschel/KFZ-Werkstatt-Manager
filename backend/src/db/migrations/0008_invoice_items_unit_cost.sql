-- Add unit_cost column to invoice_items for cost-of-goods tracking
ALTER TABLE "invoice_items" ADD COLUMN "unit_cost" numeric(10, 2) NOT NULL DEFAULT '0';
