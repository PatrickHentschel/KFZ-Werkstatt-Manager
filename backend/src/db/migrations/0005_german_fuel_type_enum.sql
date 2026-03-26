-- Migrate fuel_type enum values from English to German
-- Recreate the enum with German values and migrate existing data via USING clause
-- (cannot ADD VALUE and use it in the same transaction in PostgreSQL)

CREATE TYPE "public"."fuel_type_new" AS ENUM('benzin', 'diesel', 'elektro', 'hybrid', 'lpg', 'cng', 'sonstige');
--> statement-breakpoint
ALTER TABLE vehicles ALTER COLUMN fuel_type
  TYPE "public"."fuel_type_new"
  USING (CASE fuel_type::text
    WHEN 'gasoline' THEN 'benzin'
    WHEN 'electric' THEN 'elektro'
    WHEN 'other'    THEN 'sonstige'
    ELSE fuel_type::text
  END)::"public"."fuel_type_new";
--> statement-breakpoint
DROP TYPE "public"."fuel_type";
--> statement-breakpoint
ALTER TYPE "public"."fuel_type_new" RENAME TO "fuel_type";
