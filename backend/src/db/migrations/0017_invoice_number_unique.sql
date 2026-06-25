-- §14 UStG: lückenlose, fortlaufende Rechnungsnummer pro Tenant.
-- Belt-and-suspenders gegen Doppelvergabe — TX-Counter-Bump ist die Hauptverteidigung,
-- dieser Constraint fängt jeden zukünftigen Bug ab, bevor zwei Belege dieselbe Nummer tragen.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenant_number_unique"
  ON "invoices" ("tenant_id", "invoice_number");
