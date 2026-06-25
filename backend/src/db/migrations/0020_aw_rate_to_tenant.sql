-- Globaler AW-Satz zieht von Mitarbeitern auf den Mandanten.
-- Default 95.00 als typischer Einstiegswert; wird in den Einstellungen angepasst.
ALTER TABLE "tenants" ADD COLUMN "aw_rate" decimal(10,2) NOT NULL DEFAULT 95.00;
