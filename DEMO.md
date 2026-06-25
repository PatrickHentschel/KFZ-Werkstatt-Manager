# WerkstattClone — Demo Zugangsdaten

## App URLs

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | http://localhost:5273        |
| Backend  | http://localhost:3009        |
| Health   | http://localhost:3009/health |

## Zugänge

| E-Mail                      | Passwort | Rolle       |
| --------------------------- | -------- | ----------- |
| owner@demo-werkstatt.de     | demo1234 | owner       |
| admin@demo-werkstatt.de     | demo1234 | admin       |
| tech@demo-werkstatt.de      | demo1234 | technician  |

## Werkstatt

| Feld   | Wert                |
| ------ | ------------------- |
| Name   | Demo Werkstatt GmbH |
| Land   | Deutschland (DE)    |
| MwSt   | 19 %                |
| Prefix | RE                  |
| IBAN   | DE89370400440532013000 |

## Seed-Daten

| Bereich    | Inhalt |
| ---------- | ------ |
| Kunden     | 5 (3× privat, 2× Firma) |
| Fahrzeuge  | 6 (VW Golf, BMW 320d, Mercedes C200, VW Transporter, Opel Astra, Ford Transit) |
| Mitarbeiter | 3 (Meister, Serviceberaterin, Techniker) |
| Lieferanten | 2 (Bosch, Würth) |
| Teile      | 8 — davon 3 unter Mindestbestand |
| Aufträge   | 6 (offen, in Bearbeitung, Teile fehlen, fertig, 2× abgerechnet) |
| Rechnungen | 5× Rechnung (2× bezahlt, 1× versendet, 1× Entwurf, 1× storniert) + 1× Gutschrift + 1× Angebot |

## Docker starten

```bash
# Starten
podman compose up -d

# Datenbank einrichten (nur beim ersten Start)
podman compose exec backend npm run db:migrate
podman compose exec backend npm run db:seed

# Logs
docker-compose logs -f

# Stoppen
docker-compose down
```

## Datenbank zurücksetzen

```bash
# DB-Container stoppen und Volume löschen
docker-compose down -v

# Neu starten + Tabellen + Seed
docker-compose up -d
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed
```

**Wichtig:** Nach einem DB-Reset Browser-Daten löschen, sonst bleibt der alte Login-Status im
`localStorage` und alle API-Anfragen schlagen mit 401 fehl, bis der Redirect zur Login-Seite abgeschlossen ist.

Chrome/Edge: `F12 → Application → Storage → Clear site data`  
Firefox: `F12 → Storage → Local Storage → Rechtsklick → Alle löschen`  
Oder Inkognito-Fenster öffnen.
