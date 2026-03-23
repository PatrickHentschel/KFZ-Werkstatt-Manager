import { pgTable, uuid, varchar, text, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const customerTypeEnum = pgEnum('customer_type', ['private', 'business']);

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: customerTypeEnum('type').notNull().default('private'),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  companyName: varchar('company_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  mobile: varchar('mobile', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 2 }).notNull().default('DE'),
  taxId: varchar('tax_id', { length: 50 }),
  notes: text('notes'),
  portalToken: varchar('portal_token', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
