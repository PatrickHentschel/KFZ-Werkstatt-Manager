-- Tenant isolation via PostgreSQL Row-Level Security (RLS).
--
-- Strategy:
--   1. A helper function reads the current tenant UUID from the GUC
--      app.current_tenant_id that the application sets per-request.
--   2. Every tenant-data table gets RLS enabled + FORCED (so the table
--      owner is also subject to policies).
--   3. A single "tenant_isolation" policy is created per table:
--      USING  → filters rows on SELECT / UPDATE / DELETE
--      WITH CHECK → enforces on INSERT / UPDATE (prevents writing to
--                   another tenant's rows)
--   4. Child tables (order_items, invoice_items) without a direct
--      tenant_id use an EXISTS subquery through their parent.
--   5. Auth tables (tenants, users, refresh_tokens) are excluded because
--      login/register must work before a tenant context exists.

-- ─── Helper function ───────────────────────────────────────────────────────
-- Returns NULL when the GUC is absent or empty; NULL != any UUID, so every
-- policy silently blocks access rather than throwing a cast error.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql SECURITY INVOKER STABLE;

-- ─── Tables with a direct tenant_id column ─────────────────────────────────
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers     FORCE  ROW LEVEL SECURITY;

ALTER TABLE vehicles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles      FORCE  ROW LEVEL SECURITY;

ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        FORCE  ROW LEVEL SECURITY;

ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      FORCE  ROW LEVEL SECURITY;

ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments  FORCE  ROW LEVEL SECURITY;

ALTER TABLE parts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts         FORCE  ROW LEVEL SECURITY;

ALTER TABLE vendors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors       FORCE  ROW LEVEL SECURITY;

ALTER TABLE staff         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff         FORCE  ROW LEVEL SECURITY;

ALTER TABLE time_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries  FORCE  ROW LEVEL SECURITY;

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens FORCE  ROW LEVEL SECURITY;

-- Policies for tables with direct tenant_id
CREATE POLICY tenant_isolation ON customers
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON vehicles
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON orders
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON invoices
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON appointments
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON parts
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON vendors
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON staff
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON time_entries
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON google_tokens
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ─── Child tables (no direct tenant_id) ────────────────────────────────────
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   FORCE  ROW LEVEL SECURITY;

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE  ROW LEVEL SECURITY;

-- order_items: scoped through parent orders row
CREATE POLICY tenant_isolation ON order_items
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND orders.tenant_id = current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
      AND orders.tenant_id = current_tenant_id()
  ));

-- invoice_items: scoped through parent invoices row
CREATE POLICY tenant_isolation ON invoice_items
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND invoices.tenant_id = current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND invoices.tenant_id = current_tenant_id()
  ));
