-- Customer-Erweiterung: Anrede, Geburtsdatum, getrennte Adresse

CREATE TYPE "salutation" AS ENUM ('herr', 'frau', 'divers');

ALTER TABLE "customers" ADD COLUMN "salutation" "salutation";
ALTER TABLE "customers" ADD COLUMN "birth_date" date;
ALTER TABLE "customers" ADD COLUMN "street" varchar(255);
ALTER TABLE "customers" ADD COLUMN "house_number" varchar(20);

-- Best effort: bestehende `address` in `street` migrieren (Hausnummer bleibt leer).
UPDATE "customers" SET "street" = "address" WHERE "address" IS NOT NULL;

ALTER TABLE "customers" DROP COLUMN "address";
