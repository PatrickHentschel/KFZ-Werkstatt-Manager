import { FastifyPluginAsync } from 'fastify';
import { eq, and, gte, lte, sql, count, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db';
import { orders, invoices, invoiceItems, timeEntries, staff, orderItems, parts } from '../../db/schema';

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
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const tax = Number(item.taxRate) / 100;
        const net = qty * price;
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
      const name = c.type === 'business' ? (c.companyName || `${c.firstName} ${c.lastName}`) : `${c.firstName} ${c.lastName}`;
      const existing = map.get(c.id) || { customerId: c.id, name, type: c.type, invoiceCount: 0, totalNet: 0 };
      existing.invoiceCount += 1;
      for (const item of inv.items) {
        existing.totalNet += Number(item.quantity) * Number(item.unitPrice);
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

    const orderIds = paidInvoices.map(i => i.orderId).filter(Boolean) as string[];

    let laborNet = 0, partsNet = 0, miscNet = 0, costOfGoods = 0;
    let laborCost = 0;

    // Classify revenue using invoice items (which carry the type field)
    for (const inv of paidInvoices) {
      for (const item of inv.items) {
        const net = Number(item.quantity) * Number(item.unitPrice);
        if (item.type === 'labor') {
          laborNet += net;
        } else if (item.type === 'part') {
          partsNet += net;
        } else {
          miscNet += net;
        }
      }
    }

    // Cost of goods: still sourced from orderItems (where purchasePrice lives via parts join)
    if (orderIds.length > 0) {
      const partItems = await db
        .select({
          quantity: orderItems.quantity,
          purchasePrice: parts.purchasePrice,
        })
        .from(orderItems)
        .leftJoin(parts, eq(orderItems.partId, parts.id))
        .where(and(inArray(orderItems.orderId, orderIds), isNotNull(orderItems.partId)));

      for (const item of partItems) {
        if (item.purchasePrice) {
          costOfGoods += Number(item.quantity) * Number(item.purchasePrice);
        }
      }

      // Calculate labor cost from time entries
      const entries = await db
        .select({
          durationMinutes: timeEntries.durationMinutes,
          hourlyRate: staff.hourlyRate,
        })
        .from(timeEntries)
        .innerJoin(staff, eq(timeEntries.staffId, staff.id))
        .where(and(isNotNull(timeEntries.orderId), inArray(timeEntries.orderId, orderIds)));

      for (const entry of entries) {
        if (entry.durationMinutes && entry.hourlyRate) {
          laborCost += (entry.durationMinutes / 60) * Number(entry.hourlyRate);
        }
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      period: { from: from || null, to: to || null },
      laborNet: round(laborNet),
      partsNet: round(partsNet),
      miscNet: round(miscNet),
      costOfGoods: round(costOfGoods),
      laborCost: round(laborCost),
      grossProfit: round(laborNet + partsNet + miscNet - costOfGoods - laborCost),
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
