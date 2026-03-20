import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';
import { vehicles } from './vehicles';

export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']);

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  orderId: uuid('order_id'),
  staffId: uuid('staff_id'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  color: varchar('color', { length: 20 }),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  reminderSentAt: timestamp('reminder_sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
