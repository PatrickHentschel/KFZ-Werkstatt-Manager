-- Add type column to invoice_items for revenue breakdown classification
ALTER TABLE "invoice_items" ADD COLUMN "type" "order_item_type" NOT NULL DEFAULT 'misc';
