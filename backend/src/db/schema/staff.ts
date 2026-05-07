import { pgTable, uuid, varchar, decimal, boolean, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 100 }).notNull().default('Techniker'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2, mode: 'number' }),
  awRate: decimal('aw_rate', { precision: 10, scale: 2, mode: 'number' }),
  costRate: decimal('cost_rate', { precision: 10, scale: 2, mode: 'number' }),
  color: varchar('color', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id),
  orderId: uuid('order_id'),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  durationMinutes: integer('duration_minutes'),
  isManual: boolean('is_manual').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type StaffMember = typeof staff.$inferSelect;
export type NewStaffMember = typeof staff.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
