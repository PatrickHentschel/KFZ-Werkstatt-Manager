import { eq, and, sql, or, ilike, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../db';
import { invoices, invoiceItems, tenants, orders, customers, parts } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

type ItemInput = {
  type?: 'labor' | 'part' | 'misc';
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  taxRate: number;
  unit?: string;
  serviceDate?: string | null;
  discountAmount?: number;
  discountPercent?: number;
  sortOrder?: number;
};

type DraftItemInput = Partial<ItemInput> & { description?: string };

const today = () => new Date().toISOString().split('T')[0];

/**
 * §19 UStG: Kleinunternehmer dürfen keine Umsatzsteuer ausweisen.
 * Items mit taxRate ≠ 0 werden vom Service abgelehnt.
 */
async function assertSmallBusinessRule(tenantId: string, items: Array<{ taxRate?: number }> | undefined) {
  if (!items || items.length === 0) return;
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { isSmallBusiness: true },
  });
  if (!tenant?.isSmallBusiness) return;
  const violation = items.some(i => i.taxRate != null && Number(i.taxRate) !== 0);
  if (violation) {
    throw errors.badRequest('Kleinunternehmer (§19 UStG): Positionen müssen 0% MwSt haben.');
  }
}

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
        with: { customer: true, items: true, cancelsInvoice: { columns: { invoiceNumber: true, issueDate: true } } },
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
      with: { customer: true, items: true, cancelsInvoice: { columns: { invoiceNumber: true, issueDate: true } } },
    });
    if (!invoice) throw errors.notFound('Invoice');
    return invoice;
  }

  async create(tenantId: string, data: {
    type: 'invoice' | 'quote' | 'credit_note';
    customerId: string;
    orderId?: string;
    serviceDate?: string;
    dueDate: string;          // Pflicht
    notes?: string;
    skontoPercent?: number;
    skontoDays?: number;
    items: ItemInput[];
  }) {
    await assertSmallBusinessRule(tenantId, data.items);
    if (!data.dueDate) throw errors.badRequest('Fälligkeitsdatum ist Pflicht');

    // issueDate IMMER server-seitig: aktuelles Datum.
    // Counter-Bump + INSERT in TX → bei Rollback keine Lücke (§14 UStG).
    return db.transaction(async (tx) => {
      const [tenant] = await tx
        .update(tenants)
        .set({ invoiceCounter: sql`${tenants.invoiceCounter} + 1` })
        .where(eq(tenants.id, tenantId))
        .returning();
      const invoiceNumber = `${tenant.invoicePrefix}-${String(tenant.invoiceCounter).padStart(5, '0')}`;
      const issueDate = today();

      const [invoice] = await tx.insert(invoices).values({
        tenantId,
        invoiceNumber,
        type: data.type,
        customerId: data.customerId,
        orderId: data.orderId,
        issueDate,
        serviceDate: data.serviceDate ?? issueDate,
        dueDate: data.dueDate,
        skontoPercent: data.skontoPercent ?? null,
        skontoDays: data.skontoDays ?? null,
        notes: data.notes,
      }).returning();

      if (data.items.length > 0) {
        await tx.insert(invoiceItems).values(
          data.items.map((item, idx) => ({
            invoiceId: invoice.id,
            type: item.type ?? 'misc',
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost ?? 0,
            taxRate: item.taxRate,
            unit: item.unit || null,
            serviceDate: item.serviceDate ?? null,
            discountAmount: item.discountAmount ?? 0,
            discountPercent: item.discountPercent ?? 0,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }

      return tx.query.invoices.findFirst({
        where: and(eq(invoices.id, invoice.id), eq(invoices.tenantId, tenantId)),
        with: { customer: true, items: true, cancelsInvoice: { columns: { invoiceNumber: true, issueDate: true } } },
      });
    });
  }

  async createFromOrder(tenantId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      with: { items: true },
    });
    if (!order) throw errors.notFound('Order');

    const partIds = order.items.filter(i => i.partId).map(i => i.partId as string);
    const partPrices = new Map<string, number>();
    if (partIds.length > 0) {
      const catalogParts = await db.query.parts.findMany({
        where: inArray(parts.id, partIds),
        columns: { id: true, purchasePrice: true },
      });
      for (const p of catalogParts) {
        partPrices.set(p.id, Number(p.purchasePrice));
      }
    }

    const todayStr = today();
    const due = new Date();
    due.setDate(due.getDate() + 14);

    const serviceDate = order.estimatedDone
      ? order.estimatedDone.toISOString().split('T')[0]
      : todayStr;

    return this.create(tenantId, {
      type: 'invoice',
      customerId: order.customerId,
      orderId,
      serviceDate,
      dueDate: due.toISOString().split('T')[0],
      items: order.items.map(item => ({
        type: item.type,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unitCost: item.partId ? (partPrices.get(item.partId) ?? 0) : 0,
        taxRate: Number(item.taxRate),
        unit: item.unit || undefined,
        sortOrder: item.sortOrder,
      })),
    });
  }

  async update(tenantId: string, id: string, data: {
    type?: 'invoice' | 'quote' | 'credit_note';
    serviceDate?: string | null;
    dueDate?: string;
    notes?: string;
    orderId?: string;
    skontoPercent?: number | null;
    skontoDays?: number | null;
    items?: ItemInput[];
  }) {
    await assertSmallBusinessRule(tenantId, data.items);

    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    });
    if (!invoice) throw errors.notFound('Invoice');
    if (invoice.status !== 'draft') throw errors.badRequest('Nur Entwürfe können bearbeitet werden');

    // issueDate wird NIE manuell gesetzt — beim Promote durch updateStatus.
    await db.update(invoices)
      .set({
        type: data.type ?? invoice.type,
        serviceDate: data.serviceDate !== undefined ? data.serviceDate : invoice.serviceDate,
        dueDate: data.dueDate !== undefined ? data.dueDate : invoice.dueDate,
        skontoPercent: data.skontoPercent !== undefined ? data.skontoPercent : invoice.skontoPercent,
        skontoDays: data.skontoDays !== undefined ? data.skontoDays : invoice.skontoDays,
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
            type: item.type ?? 'misc',
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost ?? 0,
            taxRate: item.taxRate,
            unit: item.unit || null,
            serviceDate: item.serviceDate ?? null,
            discountAmount: item.discountAmount ?? 0,
            discountPercent: item.discountPercent ?? 0,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
    }

    return this.getById(tenantId, id);
  }

  async createDraft(tenantId: string, data: {
    type?: 'invoice' | 'quote' | 'credit_note';
    customerId?: string;
    orderId?: string;
    serviceDate?: string | null;
    dueDate?: string;
    notes?: string;
    skontoPercent?: number | null;
    skontoDays?: number | null;
    items?: DraftItemInput[];
  }) {
    // 'DRAFT-' + 8-char UUID. Konsumiert NICHT den Counter — wird erst beim Promote gezogen.
    const invoiceNumber = `DRAFT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

    const [invoice] = await db.insert(invoices).values({
      tenantId,
      invoiceNumber,
      status: 'draft',
      type: data.type ?? 'invoice',
      customerId: data.customerId ?? null,
      orderId: data.orderId,
      issueDate: null,                        // Drafts haben kein issueDate — wird beim Promote gesetzt
      serviceDate: data.serviceDate ?? null,
      dueDate: data.dueDate,
      skontoPercent: data.skontoPercent ?? null,
      skontoDays: data.skontoDays ?? null,
      notes: data.notes,
    }).returning();

    if (data.items && data.items.length > 0) {
      const validItems = data.items.filter(i => i.description && i.description.trim().length > 0);
      if (validItems.length > 0) {
        await db.insert(invoiceItems).values(
          validItems.map((item, idx) => ({
            invoiceId: invoice.id,
            type: item.type ?? 'misc',
            description: item.description!,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            unitCost: item.unitCost ?? 0,
            taxRate: item.taxRate ?? 19,
            unit: item.unit || null,
            serviceDate: item.serviceDate ?? null,
            discountAmount: item.discountAmount ?? 0,
            discountPercent: item.discountPercent ?? 0,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
    }

    return this.getById(tenantId, invoice.id);
  }

  async updateDraft(tenantId: string, id: string, data: {
    type?: 'invoice' | 'quote' | 'credit_note';
    customerId?: string;
    orderId?: string;
    serviceDate?: string | null;
    dueDate?: string;
    notes?: string;
    skontoPercent?: number | null;
    skontoDays?: number | null;
    items?: DraftItemInput[];
  }) {
    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    });
    if (!existing) throw errors.notFound('Draft');
    if (existing.status !== 'draft') throw errors.badRequest('Only drafts can be updated via this endpoint');

    await db.update(invoices)
      .set({
        type: data.type ?? existing.type,
        customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
        orderId: data.orderId !== undefined ? data.orderId : existing.orderId,
        serviceDate: data.serviceDate !== undefined ? data.serviceDate : existing.serviceDate,
        dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
        skontoPercent: data.skontoPercent !== undefined ? data.skontoPercent : existing.skontoPercent,
        skontoDays: data.skontoDays !== undefined ? data.skontoDays : existing.skontoDays,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

    if (data.items !== undefined) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const validItems = data.items.filter(i => i.description && i.description.trim().length > 0);
      if (validItems.length > 0) {
        await db.insert(invoiceItems).values(
          validItems.map((item, idx) => ({
            invoiceId: id,
            type: item.type ?? 'misc',
            description: item.description!,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            unitCost: item.unitCost ?? 0,
            taxRate: item.taxRate ?? 19,
            unit: item.unit || null,
            serviceDate: item.serviceDate ?? null,
            discountAmount: item.discountAmount ?? 0,
            discountPercent: item.discountPercent ?? 0,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
    }

    return this.getById(tenantId, id);
  }

  async deleteDraft(tenantId: string, id: string) {
    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    });
    if (!existing) throw errors.notFound('Draft');
    if (existing.status !== 'draft') throw errors.badRequest('Only drafts can be deleted via this endpoint');

    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
  }

  async updateStatus(tenantId: string, id: string, status: InvoiceStatus) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .for('update');
      if (!existing) throw errors.notFound('Invoice');

      const updates: Partial<typeof invoices.$inferInsert> = { status, updatedAt: new Date() };
      if (status === 'paid') updates.paidAt = new Date();

      // Promote: DRAFT → echte Rechnung. Pflichtfelder erzwingen.
      const isLeavingDraft =
        existing.invoiceNumber.startsWith('DRAFT-') && status !== 'draft';

      if (isLeavingDraft) {
        if (!existing.dueDate) {
          throw errors.badRequest('Fälligkeitsdatum ist Pflicht vor dem Versand.');
        }
        const [tenant] = await tx
          .update(tenants)
          .set({ invoiceCounter: sql`${tenants.invoiceCounter} + 1` })
          .where(eq(tenants.id, tenantId))
          .returning();
        updates.invoiceNumber = `${tenant.invoicePrefix}-${String(tenant.invoiceCounter).padStart(5, '0')}`;
        // Ausstellungsdatum IMMER beim Promote = jetzt (User darf es nicht vorab setzen).
        updates.issueDate = today();
        if (existing.serviceDate == null) updates.serviceDate = updates.issueDate;
      }

      const [updated] = await tx
        .update(invoices)
        .set(updates)
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .returning();
      if (!updated) throw errors.notFound('Invoice');

      return tx.query.invoices.findFirst({
        where: and(eq(invoices.id, updated.id), eq(invoices.tenantId, tenantId)),
        with: { customer: true, items: true, cancelsInvoice: { columns: { invoiceNumber: true, issueDate: true } } },
      });
    });
  }

  /**
   * Storno: erzeugt eine credit_note mit eigenem Nummernkreis (cancelInvoicePrefix-NNNNN),
   * spiegelt Items mit negativen Mengen, setzt Original auf 'cancelled'.
   * Original muss 'sent' oder 'paid' sein. Atomar.
   */
  async cancelInvoice(tenantId: string, id: string) {
    return db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .for('update');
      if (!original) throw errors.notFound('Invoice');
      if (original.type !== 'invoice') {
        throw errors.badRequest('Nur Rechnungen können storniert werden, keine Stornos oder Angebote.');
      }
      if (original.status !== 'sent' && original.status !== 'paid') {
        throw errors.badRequest('Nur offene oder bezahlte Rechnungen können storniert werden.');
      }
      if (original.cancelsInvoiceId) {
        throw errors.badRequest('Diese Rechnung ist bereits eine Stornorechnung.');
      }

      const originalItems = await tx.query.invoiceItems.findMany({
        where: eq(invoiceItems.invoiceId, original.id),
      });

      // Storno-Nummer aus dedizietem Counter
      const [tenant] = await tx
        .update(tenants)
        .set({ cancelInvoiceCounter: sql`${tenants.cancelInvoiceCounter} + 1` })
        .where(eq(tenants.id, tenantId))
        .returning();
      const cancelNumber = `${tenant.cancelInvoicePrefix}-${String(tenant.cancelInvoiceCounter).padStart(5, '0')}`;

      const issueDate = today();
      const [storno] = await tx.insert(invoices).values({
        tenantId,
        invoiceNumber: cancelNumber,
        type: 'credit_note',
        status: 'sent',                              // Storno ist sofort offen/aktiv
        customerId: original.customerId,
        orderId: original.orderId,
        cancelsInvoiceId: original.id,
        issueDate,
        serviceDate: original.serviceDate ?? issueDate,
        dueDate: issueDate,                          // sofort fällig (informativ)
        skontoPercent: null,
        skontoDays: null,
        notes: `Stornorechnung zu Rechnung ${original.invoiceNumber} vom ${original.issueDate ?? '-'}.`,
      }).returning();

      if (originalItems.length > 0) {
        await tx.insert(invoiceItems).values(
          originalItems.map((item, idx) => ({
            invoiceId: storno.id,
            type: item.type,
            description: item.description,
            // Negativ: Mengen invertieren — netTotal kommt automatisch negativ raus.
            quantity: -Number(item.quantity),
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            taxRate: item.taxRate,
            unit: item.unit,
            serviceDate: item.serviceDate,
            discountAmount: item.discountAmount,
            discountPercent: item.discountPercent,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }

      // Original auf cancelled
      await tx.update(invoices)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(invoices.id, original.id));

      return tx.query.invoices.findFirst({
        where: and(eq(invoices.id, storno.id), eq(invoices.tenantId, tenantId)),
        with: { customer: true, items: true, cancelsInvoice: { columns: { invoiceNumber: true, issueDate: true } } },
      });
    });
  }
}

export const invoicesService = new InvoicesService();
