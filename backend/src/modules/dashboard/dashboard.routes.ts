import { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, lt, lte, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { orders, invoices, invoiceItems, customers } from '../../db/schema';

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/stats', async (request) => {
    const tenantId = request.user.tenantId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const today = now.toISOString().slice(0, 10);

    // Open orders (active work)
    const [openOrdersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          inArray(orders.status, ['open', 'in_progress', 'waiting_parts']),
        ),
      );

    // Orders completed this month
    const [completedThisMonthRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          inArray(orders.status, ['done', 'invoiced']),
          gte(orders.updatedAt, startOfMonth),
        ),
      );

    // Total customers
    const { customers: customersTable } = await import('../../db/schema/customers');
    const [totalCustomersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customersTable)
      .where(eq(customersTable.tenantId, tenantId));

    // Overdue invoices (sent but past due date)
    const [overdueRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'sent'),
          lt(invoices.dueDate, today),
        ),
      );

    // Revenue this month: sum of (quantity * unitPrice * (1 + taxRate/100)) for paid invoices this month
    const paidThisMonth = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'paid'),
          gte(invoices.issueDate, startOfMonth.toISOString().slice(0, 10)),
        ),
      );

    const paidLastMonth = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, 'paid'),
          gte(invoices.issueDate, startOfLastMonth.toISOString().slice(0, 10)),
          lt(invoices.issueDate, startOfMonth.toISOString().slice(0, 10)),
        ),
      );

    const calcRevenue = async (invoiceIds: string[]): Promise<number> => {
      if (invoiceIds.length === 0) return 0;
      const items = await db
        .select({
          quantity: invoiceItems.quantity,
          unitPrice: invoiceItems.unitPrice,
          taxRate: invoiceItems.taxRate,
        })
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, invoiceIds));
      return items.reduce((sum, item) => {
        const net = Number(item.quantity) * Number(item.unitPrice);
        return sum + net * (1 + Number(item.taxRate) / 100);
      }, 0);
    };

    const [revenueThisMonth, revenueLastMonth] = await Promise.all([
      calcRevenue(paidThisMonth.map((i) => i.id)),
      calcRevenue(paidLastMonth.map((i) => i.id)),
    ]);

    // Recent orders (last 5) with customer + vehicle
    const recentOrders = await db.query.orders.findMany({
      where: eq(orders.tenantId, tenantId),
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit: 5,
      with: {
        customer: { columns: { id: true, firstName: true, lastName: true, companyName: true } },
        vehicle: { columns: { id: true, licensePlate: true, make: true, model: true } },
      },
    });

    // Recent invoices (last 5) with customer
    const recentInvoices = await db.query.invoices.findMany({
      where: eq(invoices.tenantId, tenantId),
      orderBy: (i, { desc }) => [desc(i.createdAt)],
      limit: 5,
      with: {
        customer: { columns: { id: true, firstName: true, lastName: true, companyName: true } },
      },
    });

    return {
      openOrders: openOrdersRow.count,
      ordersCompletedThisMonth: completedThisMonthRow.count,
      totalCustomers: totalCustomersRow.count,
      overdueInvoices: overdueRow.count,
      revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      revenueLastMonth: Math.round(revenueLastMonth * 100) / 100,
      recentOrders,
      recentInvoices,
    };
  });
};

export default dashboardRoutes;
