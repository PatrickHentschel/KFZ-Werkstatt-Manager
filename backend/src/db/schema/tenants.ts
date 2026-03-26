import { pgTable, uuid, varchar, text, integer, decimal, pgEnum, timestamp } from 'drizzle-orm/pg-core';

export const tenantPlanEnum = pgEnum('tenant_plan', ['trial', 'starter', 'professional', 'enterprise']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 2 }).notNull().default('DE'),
  taxId: varchar('tax_id', { length: 50 }),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('RE'),
  invoiceCounter: integer('invoice_counter').notNull().default(1),
  awMinutes: integer('aw_minutes').notNull().default(5),
  plan: tenantPlanEnum('plan').notNull().default('trial'),
  logoUrl: text('logo_url'),
  googleClientId: varchar('google_client_id', { length: 255 }),
  googleClientSecret: varchar('google_client_secret', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
