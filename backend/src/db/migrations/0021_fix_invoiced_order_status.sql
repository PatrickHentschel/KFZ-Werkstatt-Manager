-- Orders that were invoiced before the status-flip was wired up are stuck at
-- 'done'. Find them via the invoices.order_id back-reference and fix them.
UPDATE "orders"
SET "status" = 'invoiced', "updated_at" = now()
WHERE "status" = 'done'
  AND EXISTS (
    SELECT 1 FROM "invoices"
    WHERE "invoices"."order_id" = "orders"."id"
      AND "invoices"."tenant_id" = "orders"."tenant_id"
  );
