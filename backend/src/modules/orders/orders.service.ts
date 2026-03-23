import { eq, and, sql, or, ilike, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { orders, orderItems, tenants, timeEntries, customers, vehicles } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

type OrderStatus = 'open' | 'in_progress' | 'waiting_parts' | 'done' | 'invoiced';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: ['in_progress'],
  in_progress: ['waiting_parts', 'done'],
  waiting_parts: ['in_progress', 'done'],
  done: ['invoiced', 'in_progress'],
  invoiced: [],
};

export class OrdersService {
  async list(tenantId: string, query: { page?: number; pageSize?: number; status?: string; statuses?: string[]; search?: string }) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    const conditions = [eq(orders.tenantId, tenantId)];

    const statusList = query.statuses
      ? (Array.isArray(query.statuses) ? query.statuses : String(query.statuses).split(','))
      : null;
    if (statusList && statusList.length > 0) {
      conditions.push(inArray(orders.status, statusList as OrderStatus[]));
    } else if (query.status) {
      conditions.push(eq(orders.status, query.status as OrderStatus));
    }

    if (query.search) {
      const s = `%${query.search}%`;
      const matchingCustomerIds = db
        .select({ id: customers.id })
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          or(ilike(customers.firstName, s), ilike(customers.lastName, s), ilike(customers.companyName, s))
        ));
      const matchingVehicleIds = db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(and(
          eq(vehicles.tenantId, tenantId),
          or(ilike(vehicles.licensePlate, s), ilike(vehicles.make, s), ilike(vehicles.model, s))
        ));
      conditions.push(or(
        ilike(orders.orderNumber, s),
        inArray(orders.customerId, matchingCustomerIds),
        inArray(orders.vehicleId, matchingVehicleIds),
      )!);
    }

    const whereClause = and(...conditions)!;

    const [data, countResult] = await Promise.all([
      db.query.orders.findMany({
        where: () => whereClause,
        with: { customer: true, vehicle: true, items: true },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(whereClause),
    ]);

    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.tenantId, tenantId)),
      with: { customer: true, vehicle: true, items: true },
    });
    if (!order) throw errors.notFound('Order');
    return order;
  }

  async create(tenantId: string, data: {
    customerId: string;
    vehicleId: string;
    description?: string;
    mileageIn?: number;
    estimatedDone?: string;
    notes?: string;
    assignedStaffId?: string;
  }) {
    // Generate order number
    const count = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tenantId));
    const orderNumber = `WO-${String(Number(count[0]?.count || 0) + 1).padStart(5, '0')}`;

    const [order] = await db.insert(orders).values({
      ...data,
      tenantId,
      orderNumber,
      estimatedDone: data.estimatedDone ? new Date(data.estimatedDone) : undefined,
    }).returning();
    return this.getById(tenantId, order.id);
  }

  async update(tenantId: string, id: string, data: Partial<typeof orders.$inferInsert>) {
    const [updated] = await db.update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Order');
    return this.getById(tenantId, updated.id);
  }

  async updateStatus(tenantId: string, id: string, newStatus: OrderStatus) {
    const order = await this.getById(tenantId, id);
    const allowed = STATUS_TRANSITIONS[order.status as OrderStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw errors.badRequest(`Cannot transition from ${order.status} to ${newStatus}`);
    }
    return this.update(tenantId, id, { status: newStatus });
  }

  async updateItems(tenantId: string, orderId: string, items: Array<{
    type: 'labor' | 'part' | 'misc';
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    partId?: string;
    sortOrder?: number;
  }>) {
    await this.getById(tenantId, orderId); // verify ownership

    // Replace all items
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));

    if (items.length > 0) {
      await db.insert(orderItems).values(
        items.map((item, idx) => ({
          orderId,
          type: item.type,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          taxRate: String(item.taxRate),
          partId: item.partId,
          sortOrder: item.sortOrder ?? idx,
        }))
      );
    }

    return this.getById(tenantId, orderId);
  }
  async listTimeEntries(tenantId: string, orderId: string) {
    await this.getById(tenantId, orderId);
    return db.query.timeEntries.findMany({
      where: and(eq(timeEntries.orderId, orderId), eq(timeEntries.tenantId, tenantId)),
      with: { staff: true },
      orderBy: (t, { desc }) => [desc(t.startTime)],
    });
  }

  async addTimeEntry(tenantId: string, orderId: string, data: {
    staffId: string;
    description?: string;
    durationMinutes: number;
  }) {
    await this.getById(tenantId, orderId);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + data.durationMinutes * 60000);
    const [entry] = await db.insert(timeEntries).values({
      tenantId,
      orderId,
      staffId: data.staffId,
      description: data.description,
      startTime,
      endTime,
      durationMinutes: data.durationMinutes,
      isManual: true,
    }).returning();
    return db.query.timeEntries.findFirst({
      where: eq(timeEntries.id, entry.id),
      with: { staff: true },
    });
  }
}

export const ordersService = new OrdersService();
