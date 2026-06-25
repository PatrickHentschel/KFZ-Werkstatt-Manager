import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { invoices } from './invoices';

export const invoiceDocumentKindEnum = pgEnum('invoice_document_kind', ['pdf', 'xrechnung']);

/**
 * §147 AO: aufbewahrungspflichtige Belege werden beim ersten Versand
 * persistiert. UNIQUE(invoice_id, kind) erzwingt write-once — keine
 * versehentliche Überschreibung beim Re-Send.
 */
export const invoiceDocuments = pgTable('invoice_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  kind: invoiceDocumentKindEnum('kind').notNull(),
  filePath: text('file_path').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),  // sha256 hex
  byteSize: integer('byte_size').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  invoiceKindUnique: uniqueIndex('invoice_documents_invoice_kind_unique').on(t.invoiceId, t.kind),
  tenantIdx: index('invoice_documents_tenant_idx').on(t.tenantId),
}));

export type InvoiceDocument = typeof invoiceDocuments.$inferSelect;
export type NewInvoiceDocument = typeof invoiceDocuments.$inferInsert;
export type InvoiceDocumentKind = (typeof invoiceDocumentKindEnum.enumValues)[number];
