-- Migrate fuel_type enum values from English to German
-- Step 1: add new German values to the existing enum
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'benzin';
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'elektro';
ALTER TYPE "public"."fuel_type" ADD VALUE IF NOT EXISTS 'sonstige';
--> statement-breakpoint

-- Step 2: migrate existing rows
UPDATE vehicles SET fuel_type = 'benzin'   WHERE fuel_type = 'gasoline';
UPDATE vehicles SET fuel_type = 'elektro'  WHERE fuel_type = 'electric';
UPDATE vehicles SET fuel_type = 'sonstige' WHERE fuel_type = 'other';
--> statement-breakpoint

-- Step 3: replace the enum type (PostgreSQL cannot drop individual values, so recreate)
CREATE TYPE "public"."fuel_type_new" AS ENUM('benzin', 'diesel', 'elektro', 'hybrid', 'lpg', 'cng', 'sonstige');
--> statement-breakpoint
ALTER TABLE vehicles ALTER COLUMN fuel_type TYPE "public"."fuel_type_new" USING fuel_type::text::"public"."fuel_type_new";
--> statement-breakpoint
DROP TYPE "public"."fuel_type";
--> statement-breakpoint
ALTER TYPE "public"."fuel_type_new" RENAME TO "fuel_type";
