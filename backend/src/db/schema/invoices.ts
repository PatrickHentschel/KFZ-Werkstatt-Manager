import { pgTable, uuid, varchar, decimal, text, timestamp, pgEnum, date, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders } from './orders';

export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'cancelled']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['invoice', 'quote', 'credit_note']);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  type: invoiceTypeEnum('type').notNull().default('invoice'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  orderId: uuid('order_id').references(() => orders.id),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
