-- Vehicle: HSN/TSN, Getriebe, Erstzulassung, KM-Stand Pflicht. Baujahr weg.

CREATE TYPE "transmission" AS ENUM ('manual', 'automatic', 'semi_automatic');

ALTER TABLE "vehicles" ADD COLUMN "hsn" varchar(4);
ALTER TABLE "vehicles" ADD COLUMN "tsn" varchar(3);
ALTER TABLE "vehicles" ADD COLUMN "transmission" "transmission";
ALTER TABLE "vehicles" ADD COLUMN "first_registration" date;

-- Best effort: Baujahr → Erstzulassung 01.01.JJJJ
UPDATE "vehicles" SET "first_registration" = make_date("year", 1, 1) WHERE "year" IS NOT NULL;

-- KM-Stand → Pflicht
UPDATE "vehicles" SET "mileage" = 0 WHERE "mileage" IS NULL;
ALTER TABLE "vehicles" ALTER COLUMN "mileage" SET DEFAULT 0;
ALTER TABLE "vehicles" ALTER COLUMN "mileage" SET NOT NULL;

ALTER TABLE "vehicles" DROP COLUMN "year";
