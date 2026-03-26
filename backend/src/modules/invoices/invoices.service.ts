import { eq, and, sql, or, ilike, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, invoiceItems, tenants, orders, customers } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export class InvoicesService {
  async list(tenantId: string, query: any) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    const conditions = [eq(invoices.tenantId, tenantId)];
    const statusList = query.statuses
      ? (Array.isArray(query.statuses) ? query.statuses : String(query.statuses).split(','))
      : null;
    if (statusList && statusList.length > 0) {
      conditions.push(inArray(invoices.status, statusList as InvoiceStatus[]));
    } else if (query.status) {
      conditions.push(eq(invoices.status, query.status as InvoiceStatus));
    }
    if (query.search) {
      const s = `%${query.search}%`;
      const matchingCustomerIds = db
        .select({ id: customers.id })
        .from(customers)
        .where(or(ilike(customers.firstName, s), ilike(customers.lastName, s), ilike(customers.companyName, s)));
      conditions.push(or(
        ilike(invoices.invoiceNumber, s),
        sql`${invoices.issueDate}::text ilike ${s}`,
        inArray(invoices.customerId, matchingCustomerIds),
      )!);
    }
    const whereClause = and(...conditions)!;

    const [data, countResult] = await Promise.all([
      db.query.invoices.findMany({
        where: () => whereClause,
        with: { customer: true, items: true },
        orderBy: (i, { desc }) => [desc(i.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(invoices).where(whereClause),
    ]);

    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
      with: { customer: true, items: true },
    });
    if (!invoice) throw errors.notFound('Invoice');
    return invoice;
  }

  async create(tenantId: string, data: {
    type: 'invoice' | 'quote' | 'credit_note';
    customerId: string;
    orderId?: string;
    issueDate: string;
    dueDate?: string;
    notes?: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; unit?: string; sortOrder?: number }>;
  }) {
    // Generate invoice number
    const [tenant] = await db.update(tenants)
      .set({ invoiceCounter: sql`${tenants.invoiceCounter} + 1` })
      .where(eq(tenants.id, tenantId))
      .returning();

    const invoiceNumber = `${tenant.invoicePrefix}-${String(tenant.invoiceCounter).padStart(5, '0')}`;

    const [invoice] = await db.insert(invoices).values({
      tenantId,
      invoiceNumber,
      type: data.type,
      customerId: data.customerId,
      orderId: data.orderId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      notes: data.notes,
    }).returning();

    if (data.items.length > 0) {
      await db.insert(invoiceItems).values(
        data.items.map((item, idx) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          taxRate: String(item.taxRate),
          unit: item.unit || null,
          sortOrder: item.sortOrder ?? idx,
        }))
      );
    }

    return this.getById(tenantId, invoice.id);
  }

  async createFromOrder(tenantId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      with: { items: true },
    });
    if (!order) throw errors.notFound('Order');

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    return this.create(tenantId, {
      type: 'invoice',
      customerId: order.customerId,
      orderId,
      issueDate: today,
      dueDate: dueDate.toISOString().split('T')[0],
      items: order.items.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        unit: item.unit || undefined,
        sortOrder: item.sortOrder,
      })),
    });
  }

  async update(tenantId: string, id: string, data: {
    type?: 'invoice' | 'quote' | 'credit_note';
    issueDate?: string;
    dueDate?: string;
    notes?: string;
    orderId?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; unit?: string; sortOrder?: number }>;
  }) {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    });
    if (!invoice) throw errors.notFound('Invoice');
    if (invoice.status !== 'draft') throw errors.badRequest('Nur Entwürfe können bearbeitet werden');

    await db.update(invoices)
      .set({
        type: data.type ?? invoice.type,
        issueDate: data.issueDate ?? invoice.issueDate,
        dueDate: data.dueDate !== undefined ? data.dueDate : invoice.dueDate,
        notes: data.notes !== undefined ? data.notes : invoice.notes,
        orderId: data.orderId !== undefined ? data.orderId : invoice.orderId,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

    if (data.items !== undefined) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      if (data.items.length > 0) {
        await db.insert(invoiceItems).values(
          data.items.map((item, idx) => ({
            invoiceId: id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            taxRate: String(item.taxRate),
            unit: item.unit || null,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
    }

    return this.getById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, status: InvoiceStatus) {
    const updates: Partial<typeof invoices.$inferInsert> = { status, updatedAt: new Date() };
    if (status === 'paid') updates.paidAt = new Date();

    const [updated] = await db.update(invoices)
      .set(updates)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Invoice');
    return this.getById(tenantId, updated.id);
  }
}

export const invoicesService = new InvoicesService();
