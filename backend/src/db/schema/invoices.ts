import { pgTable, uuid, varchar, decimal, text, timestamp, pgEnum, date, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { orders, orderItemTypeEnum } from './orders';

export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'cancelled']);
export const invoiceTypeEnum = pgEnum('invoice_type', ['invoice', 'quote', 'credit_note']);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  type: invoiceTypeEnum('type').notNull().default('invoice'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  customerId: uuid('customer_id').references(() => customers.id),
  orderId: uuid('order_id').references(() => orders.id),
  issueDate: date('issue_date'),
  serviceDate: date('service_date'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at'),
  // Skonto: Zahlungsabzug bei Zahlung innerhalb skontoDays Tagen
  skontoPercent: decimal('skonto_percent', { precision: 5, scale: 2, mode: 'number' }),
  skontoDays: integer('skonto_days'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  notes: text('notes'),
  pdfUrl: text('pdf_url'),
  // Bei Storno (credit_note) → Verweis auf die ursprüngliche Rechnung.
  cancelsInvoiceId: uuid('cancels_invoice_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  type: orderItemTypeEnum('type').notNull().default('misc'),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  // Per-Item Rabatt: entweder absolut (discountAmount in €) oder relativ (discountPercent).
  // Beide können gesetzt sein — werden additiv vom Bruttozeilenwert abgezogen.
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2, mode: 'number' }).notNull().default(19.00),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  unit: varchar('unit', { length: 10 }),
  // Override: Leistungsdatum pro Position falls abweichend von invoice.serviceDate
  serviceDate: date('service_date'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
