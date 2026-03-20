import { FastifyPluginAsync } from 'fastify';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';
import { db } from '../../db';
import { orders, invoices, invoiceItems, timeEntries, staff } from '../../db/schema';

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

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
