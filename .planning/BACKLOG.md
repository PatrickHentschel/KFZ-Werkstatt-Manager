# Backlog (P1+)

Punkte aus Diskussionen die nach P0/Phase 1-3 zurückgestellt wurden.

## KBA-HSN/TSN-Lookup (Vehicle)

**Status:** HSN/TSN sind als Free-form Text-Felder im Schema (`vehicles.hsn varchar(4)`, `vehicles.tsn varchar(3)`) — funktioniert manuell, ohne Picker.

**Zielbild:** Autocomplete-Suche im VehicleDialog. User tippt HSN ein, TSN wird vorgeschlagen mit Modell-Beschreibung.

**Komponenten:**

1. **Lookup-Tabelle** `kba_types`
   ```ts
   export const kbaTypes = pgTable('kba_types', {
     hsn: varchar('hsn', { length: 4 }).notNull(),
     tsn: varchar('tsn', { length: 3 }).notNull(),
     manufacturer: varchar('manufacturer', { length: 100 }).notNull(),
     type: varchar('type', { length: 200 }).notNull(),
     fuelType: fuelTypeEnum('fuel_type'),
     engineDisplacement: integer('engine_displacement'),
     powerKw: integer('power_kw'),
     // Composite PK: (hsn, tsn) ist unique
   }, t => ({ pk: primaryKey({ columns: [t.hsn, t.tsn] }) }));
   ```
   Tenant-übergreifend (kein `tenant_id`) — gleiche Daten für alle Werkstätten.

2. **Importer** `backend/src/db/import-kba.ts`
   - CSV-Parsing (pgPa/csv-parse)
   - Erwartetes Format: `HSN;TSN;Hersteller;Typ;Kraftstoff;Hubraum;Leistung_kW`
   - `INSERT ... ON CONFLICT (hsn, tsn) DO UPDATE` — idempotent
   - Größenordnung: ~50.000 Zeilen, sollte unter 30 Sekunden laufen

3. **Search-Endpoint** `GET /api/v1/vehicles/kba-search?q=`
   - Query mindestens 2 Zeichen
   - Match auf hsn-prefix, tsn-prefix, manufacturer LIKE, type LIKE
   - Limit 20
   - Public (für eingeloggte User), kein Tenant-Scoping

4. **Frontend Picker** im VehicleDialog
   - Search-Input über HSN/TSN/Marke/Modell
   - Dropdown mit Treffern → bei Auswahl werden HSN, TSN, Marke (=manufacturer), Modell (=type), Kraftstoff, Hubraum auto-gefüllt
   - Manuelle Eingabe weiter möglich für Fahrzeuge die nicht in der Liste sind

**Datenquelle (offen):**
- Lizenzierte KBA-CSV (kba.de) — User kümmert sich
- Alternativ: GTÜ/autovista API
- Inoffiziell von kfz-auskunft.de — rechtliche Grauzone

**Schätzung:** 1-2 Tage sobald Datenquelle steht.
