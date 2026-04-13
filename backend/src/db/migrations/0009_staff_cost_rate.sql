-- Add cost_rate column to staff table for Rohgewinn calculation
ALTER TABLE "staff" ADD COLUMN "cost_rate" numeric(10, 2);
