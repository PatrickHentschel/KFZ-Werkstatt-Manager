import { pgTable, uuid, varchar, integer, decimal, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  contactPerson: varchar('contact_person', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const parts = pgTable('parts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 100 }).notNull(),
  oemNumber: varchar('oem_number', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  stockQuantity: decimal('stock_quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  minStock: decimal('min_stock', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  unit: varchar('unit', { length: 20 }).notNull().default('Stk'),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  salePrice: decimal('sale_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2, mode: 'number' }).notNull().default(19.00),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  location: varchar('location', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
