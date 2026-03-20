import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { users, refreshTokens } from './users';
import { customers } from './customers';
import { vehicles } from './vehicles';
import { orders, orderItems } from './orders';
import { invoices, invoiceItems } from './invoices';
import { appointments } from './appointments';
import { parts, vendors } from './parts';
import { staff, timeEntries } from './staff';
import { googleTokens } from './google_tokens';

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  vehicles: many(vehicles),
  orders: many(orders),
  invoices: many(invoices),
  appointments: many(appointments),
  parts: many(parts),
  staff: many(staff),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  vehicles: many(vehicles),
  orders: many(orders),
  invoices: many(invoices),
  appointments: many(appointments),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vehicles.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [vehicles.customerId], references: [customers.id] }),
  orders: many(orders),
  appointments: many(appointments),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  vehicle: one(vehicles, { fields: [orders.vehicleId], references: [vehicles.id] }),
  items: many(orderItems),
  invoices: many(invoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  tenant: one(tenants, { fields: [appointments.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
  vehicle: one(vehicles, { fields: [appointments.vehicleId], references: [vehicles.id] }),
}));

export const partsRelations = relations(parts, ({ one }) => ({
  tenant: one(tenants, { fields: [parts.tenantId], references: [tenants.id] }),
  vendor: one(vendors, { fields: [parts.vendorId], references: [vendors.id] }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vendors.tenantId], references: [tenants.id] }),
  parts: many(parts),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  tenant: one(tenants, { fields: [staff.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [staff.userId], references: [users.id] }),
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  tenant: one(tenants, { fields: [timeEntries.tenantId], references: [tenants.id] }),
  staff: one(staff, { fields: [timeEntries.staffId], references: [staff.id] }),
}));

export const googleTokensRelations = relations(googleTokens, ({ one }) => ({
  tenant: one(tenants, { fields: [googleTokens.tenantId], references: [tenants.id] }),
}));
