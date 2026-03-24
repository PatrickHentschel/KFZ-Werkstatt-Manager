import { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { orders, invoices, invoiceItems, customers } from '../../db/schema';

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/stats', async (request) => {
    const tenantId = request.user.tenantId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    // Run all count queries in parallel
    const [
      [openOrdersRow],
      [completedThisMonthRow],
      [totalCustomersRow],
      [overdueRow],
      recentOrders,
      recentInvoices,
    ] = await Promise.all([
      // Open orders: open | in_progress | waiting_parts
      db
        .select({ count: sql<string>`count(*)` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            sql`${orders.status} IN ('open', 'in_progress', 'waiting_parts')`,
          ),
        ),

      // Orders completed this month: done | invoiced, updated >= start of month
      db
        .select({ count: sql<string>`count(*)` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            sql`${orders.status} IN ('done', 'invoiced')`,
            gte(orders.updatedAt, new Date(startOfMonth)),
          ),
        ),

      // Total customers
      db
        .select({ count: sql<string>`count(*)` })
        .from(customers)
        .where(eq(customers.tenantId, tenantId)),

      // Overdue invoices: sent, past due date
      db
        .select({ count: sql<string>`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, 'sent'),
            lt(invoices.dueDate, today),
          ),
        ),

      // Recent orders with customer + vehicle
      db.query.orders.findMany({
        where: () => and(eq(orders.tenantId, tenantId))!,
        orderBy: (o, { desc }) => [desc(o.createdAt)],
        limit: 5,
        with: { customer: true, vehicle: true },
      }),

      // Recent invoices with customer
      db.query.invoices.findMany({
        where: () => and(eq(invoices.tenantId, tenantId))!,
        orderBy: (i, { desc }) => [desc(i.createdAt)],
        limit: 5,
        with: { customer: true },
      }),
    ]);

    // Calculate revenue: fetch paid invoices for each period, sum item totals
    const paidThisMonth = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'paid'),
          gte(invoices.issueDate, startOfMonth),
        ),
      );

    const paidLastMonth = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'paid'),
          gte(invoices.issueDate, startOfLastMonth),
          lt(invoices.issueDate, startOfMonth),
        ),
      );

    const calcRevenue = async (ids: string[]): Promise<number> => {
      if (ids.length === 0) return 0;
      const items = await db
        .select({ quantity: invoiceItems.quantity, unitPrice: invoiceItems.unitPrice, taxRate: invoiceItems.taxRate })
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, ids));
      return items.reduce((sum, item) => {
        const net = Number(item.quantity) * Number(item.unitPrice);
        return sum + net * (1 + Number(item.taxRate) / 100);
      }, 0);
    };

    const [revenueThisMonth, revenueLastMonth] = await Promise.all([
      calcRevenue(paidThisMonth.map((i) => i.id)),
      calcRevenue(paidLastMonth.map((i) => i.id)),
    ]);

    return {
      openOrders: Number(openOrdersRow?.count ?? 0),
      ordersCompletedThisMonth: Number(completedThisMonthRow?.count ?? 0),
      totalCustomers: Number(totalCustomersRow?.count ?? 0),
      overdueInvoices: Number(overdueRow?.count ?? 0),
      revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      revenueLastMonth: Math.round(revenueLastMonth * 100) / 100,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt,
        customer: o.customer ? {
          id: o.customer.id,
          firstName: o.customer.firstName,
          lastName: o.customer.lastName,
          companyName: o.customer.companyName,
        } : undefined,
        vehicle: o.vehicle ? {
          id: o.vehicle.id,
          licensePlate: o.vehicle.licensePlate,
          make: o.vehicle.make,
          model: o.vehicle.model,
        } : undefined,
      })),
      recentInvoices: recentInvoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        issueDate: i.issueDate,
        customer: i.customer ? {
          id: i.customer.id,
          firstName: i.customer.firstName,
          lastName: i.customer.lastName,
          companyName: i.customer.companyName,
        } : undefined,
      })),
    };
  });
};

export default dashboardRoutes;
