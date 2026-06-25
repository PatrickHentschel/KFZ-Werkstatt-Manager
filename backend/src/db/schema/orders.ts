import { pgTable, uuid, varchar, integer, decimal, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { vehicles } from './vehicles';

export const orderStatusEnum = pgEnum('order_status', ['open', 'in_progress', 'waiting_parts', 'done', 'invoiced']);
export const orderItemTypeEnum = pgEnum('order_item_type', ['labor', 'part', 'misc']);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id),
  status: orderStatusEnum('status').notNull().default('open'),
  description: text('description'),
  mileageIn: integer('mileage_in'),
  mileageOut: integer('mileage_out'),
  estimatedDone: timestamp('estimated_done'),
  assignedStaffId: uuid('assigned_staff_id'),
  notes: text('notes'),
  // Skonto wird beim Promote in die Rechnung übernommen. Default 0 = nicht aktiv.
  skontoPercent: decimal('skonto_percent', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  skontoDays: integer('skonto_days').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: orderItemTypeEnum('type').notNull().default('labor'),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  // Per-Item Rabatt: kein Pflichtfeld, Default 0.
  // Beim Promote in die Rechnung 1:1 übernommen.
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2, mode: 'number' }).notNull().default(19.00),
  unit: varchar('unit', { length: 10 }),
  partId: uuid('part_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
