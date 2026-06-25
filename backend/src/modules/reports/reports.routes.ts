import { FastifyPluginAsync } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { orders, invoices, timeEntries, staff } from '../../db/schema';

/**
 * Berechnet den effektiven Netto-Betrag einer Rechnungsposition unter
 * Berücksichtigung beider Rabatt-Varianten (% und €).
 *
 * Reihenfolge: erst prozentualer Rabatt vom Brutto, dann absoluter Rabatt.
 * Konsistent mit InvoiceFormPage-Total-Berechnung. Cap bei 0, damit
 * absurd hohe Pauschal-Rabatte nicht zu negativem Netto führen.
 */
function itemNet(item: {
  quantity: number | string;
  unitPrice: number | string;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
}): number {
  const qty = Number(item.quantity);
  const price = Number(item.unitPrice);
  const gross = qty * price;
  const dPct = Number(item.discountPercent ?? 0);
  const dAbs = Number(item.discountAmount ?? 0);
  return Math.max(0, gross - gross * (dPct / 100) - dAbs);
}

/**
 * Wareneinsatz/Personal-Kosten einer Position. Rabatt mindert NICHT den EK —
 * wir zahlen den Lieferanten unabhängig vom Kunden-Rabatt voll.
 */
function itemCost(item: { quantity: number | string; unitCost?: number | string | null }): number {
  return Number(item.unitCost ?? 0) * Number(item.quantity);
}

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireRole('owner', 'admin'));

  // Revenue report by period
  fastify.get('/revenue', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const tenantId = request.user.tenantId;

    const whereClause = and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.status, 'paid'),
      from ? gte(invoices.issueDate, from) : undefined,
      to ? lte(invoices.issueDate, to) : undefined,
    );

    // Get paid invoices with their items
    const paidInvoices = await db.query.invoices.findMany({
      where: () => whereClause!,
      with: { items: true },
      orderBy: (i, { asc }) => [asc(i.issueDate)],
    });

    // Calculate totals
    let totalNet = 0;
    let totalTax = 0;
    let totalGross = 0;

    for (const inv of paidInvoices) {
      for (const item of inv.items) {
        const tax = Number(item.taxRate) / 100;
        const net = itemNet(item);
        totalNet += net;
        totalTax += net * tax;
        totalGross += net * (1 + tax);
      }
    }

    return {
      period: { from: from || null, to: to || null },
      invoiceCount: paidInvoices.length,
      totalNet: Math.round(totalNet * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
    };
  });

  // Orders report
  fastify.get('/orders', async (request) => {
    const tenantId = request.user.tenantId;

    const statusCounts = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .groupBy(orders.status);

    return { statusCounts };
  });

  // Staff hours report
  fastify.get('/staff', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const tenantId = request.user.tenantId;

    const whereClause = and(
      eq(timeEntries.tenantId, tenantId),
      from ? gte(timeEntries.startTime, new Date(from)) : undefined,
      to ? lte(timeEntries.startTime, new Date(to)) : undefined,
    );

    const entries = await db.query.timeEntries.findMany({
      where: () => whereClause!,
      with: { staff: true },
    });

    // Group by staff
    const staffMap = new Map<string, { name: string; totalMinutes: number; entryCount: number }>();
    for (const entry of entries) {
      const key = entry.staffId;
      const existing = staffMap.get(key) || {
        name: `${entry.staff.firstName} ${entry.staff.lastName}`,
        totalMinutes: 0,
        entryCount: 0,
      };
      existing.totalMinutes += entry.durationMinutes || 0;
      existing.entryCount += 1;
      staffMap.set(key, existing);
    }

    return {
      period: { from: from || null, to: to || null },
      staff: Array.from(staffMap.entries()).map(([staffId, data]) => ({ staffId, ...data })),
    };
  });

  // Top customers by revenue or visit frequency
  fastify.get('/top-customers', async (request) => {
    const { from, to, limit = '10' } = request.query as { from?: string; to?: string; limit?: string };
    const tenantId = request.user.tenantId;

    const whereClause = and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.status, 'paid'),
      from ? gte(invoices.issueDate, from) : undefined,
      to ? lte(invoices.issueDate, to) : undefined,
    );

    const paidInvoices = await db.query.invoices.findMany({
      where: () => whereClause!,
      with: { items: true, customer: true },
    });

    const map = new Map<string, { customerId: string; name: string; type: string; invoiceCount: number; totalNet: number }>();
    for (const inv of paidInvoices) {
      const c = inv.customer;
      if (!c) continue;
      const name = c.type === 'business' ? (c.companyName || `${c.firstName} ${c.lastName}`) : `${c.firstName} ${c.lastName}`;
      const existing = map.get(c.id) || { customerId: c.id, name, type: c.type, invoiceCount: 0, totalNet: 0 };
      existing.invoiceCount += 1;
      for (const item of inv.items) {
        existing.totalNet += itemNet(item);
      }
      map.set(c.id, existing);
    }

    const customers = Array.from(map.values())
      .map(c => ({ ...c, totalNet: Math.round(c.totalNet * 100) / 100 }))
      .slice(0, Number(limit));

    return { customers };
  });

  // Revenue breakdown: labor vs parts + gross profit
  fastify.get('/revenue-breakdown', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const tenantId = request.user.tenantId;

    const whereClause = and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.status, 'paid'),
      from ? gte(invoices.issueDate, from) : undefined,
      to ? lte(invoices.issueDate, to) : undefined,
    );

    const paidInvoices = await db.query.invoices.findMany({
      where: () => whereClause!,
      with: { items: true },
    });

    let laborNet = 0, partsNet = 0, miscNet = 0;
    let costOfGoods = 0, miscCost = 0, laborCost = 0;

    // Classify revenue and costs directly from invoice items
    for (const inv of paidInvoices) {
      for (const item of inv.items) {
        const net = itemNet(item);
        const cost = itemCost(item);
        if (item.type === 'labor') {
          laborNet += net;
          laborCost += cost;
        } else if (item.type === 'part') {
          partsNet += net;
          costOfGoods += cost;
        } else {
          miscNet += net;
          miscCost += cost;
        }
      }
    }

    // Calculate staff cost based on time entries and staff cost rate
    const timeEntriesWhere = and(
      eq(timeEntries.tenantId, tenantId),
      from ? gte(timeEntries.startTime, new Date(from)) : undefined,
      to ? lte(timeEntries.startTime, new Date(to)) : undefined,
    );

    const timeEntriesData = await db.query.timeEntries.findMany({
      where: () => timeEntriesWhere!,
      with: { staff: true },
    });

    let staffCostFromTimeEntries = 0;
    for (const entry of timeEntriesData) {
      const durationHours = (entry.durationMinutes || 0) / 60;
      const staffCostRate = entry.staff.costRate ? Number(entry.staff.costRate) : 0;
      if (staffCostRate > 0 && durationHours > 0) {
        staffCostFromTimeEntries += durationHours * staffCostRate;
      }
    }

    // Use staff cost from time entries if there are time entries with cost rates
    // Otherwise fall back to the unitCost from invoice items (legacy behavior)
    const finalLaborCost = staffCostFromTimeEntries > 0 ? staffCostFromTimeEntries : laborCost;

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      period: { from: from || null, to: to || null },
      laborNet: round(laborNet),
      partsNet: round(partsNet),
      miscNet: round(miscNet),
      costOfGoods: round(costOfGoods),
      miscCost: round(miscCost),
      laborCost: round(finalLaborCost),
      grossProfit: round(laborNet + partsNet + miscNet - costOfGoods - miscCost - finalLaborCost),
    };
  });

  // Parts usage report
  fastify.get('/parts', async (request) => {
    const tenantId = request.user.tenantId;
    // Count low-stock items
    const { parts } = await import('../../db/schema');
    const lowStock = await db.query.parts.findMany({
      where: and(eq(parts.tenantId, tenantId)),
    });
    const lowStockItems = lowStock.filter(p => Number(p.stockQuantity) <= Number(p.minStock));

    return {
      totalParts: lowStock.length,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(p => ({
        id: p.id, sku: p.sku, name: p.name,
        stockQuantity: p.stockQuantity, minStock: p.minStock,
      })),
    };
  });
};

export default reportsRoutes;
