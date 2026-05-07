import { pgTable, uuid, varchar, integer, text, date, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';

export const fuelTypeEnum = pgEnum('fuel_type', ['benzin', 'diesel', 'elektro', 'hybrid', 'lpg', 'cng', 'sonstige']);
export const transmissionEnum = pgEnum('transmission', ['manual', 'automatic', 'semi_automatic']);

// HSN/TSN: KBA-Schlüsselnummern. Aktuell Free-form Text-Eingabe;
// TODO (P1): kba_types-Lookup-Tabelle + /vehicles/kba-search Picker — siehe Plan in CLAUDE.md.
export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  licensePlate: varchar('license_plate', { length: 20 }).notNull(),
  vin: varchar('vin', { length: 17 }),
  hsn: varchar('hsn', { length: 4 }),
  tsn: varchar('tsn', { length: 3 }),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  firstRegistration: date('first_registration'),
  color: varchar('color', { length: 50 }),
  engineDisplacement: integer('engine_displacement'),
  fuelType: fuelTypeEnum('fuel_type'),
  transmission: transmissionEnum('transmission'),
  mileage: integer('mileage').notNull().default(0),
  nextTuvDate: date('next_tuv_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
