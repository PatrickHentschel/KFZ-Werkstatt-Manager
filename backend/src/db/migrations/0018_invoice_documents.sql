-- §147 AO: Aufbewahrungspflicht für versendete Belege.
-- Beim ersten Versand wird die konkrete PDF/XML-Datei persistiert; alle
-- späteren Reads (View / Re-Send / Audit) liefern bit-genau dieselbe Datei.
--
-- Eine Datei pro (invoice_id, kind): write-once, niemals überschreiben.

CREATE TYPE "invoice_document_kind" AS ENUM ('pdf', 'xrechnung');

CREATE TABLE "invoice_documents" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id"    uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "kind"          "invoice_document_kind" NOT NULL,
  "file_path"     text NOT NULL,
  "content_hash"  varchar(64) NOT NULL,   -- sha256 hex
  "byte_size"     integer NOT NULL,
  "created_at"    timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "invoice_documents_invoice_kind_unique"
  ON "invoice_documents" ("invoice_id", "kind");

CREATE INDEX "invoice_documents_tenant_idx"
  ON "invoice_documents" ("tenant_id");

-- RLS analog zu invoices: tenant_id wird gegen die per-Request gesetzte GUC geprüft.
ALTER TABLE "invoice_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_documents" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "invoice_documents"
  USING      (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
