import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { customers } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

export class CustomersService {
  async list(tenantId: string, query: { page?: number; pageSize?: number; search?: string }) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);

    let whereClause = eq(customers.tenantId, tenantId);

    if (query.search) {
      const search = `%${query.search}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(customers.firstName, search),
          ilike(customers.lastName, search),
          ilike(customers.companyName, search),
          ilike(customers.email, search),
          ilike(customers.phone, search),
        )
      ) as typeof whereClause;
    }

    const [data, countResult] = await Promise.all([
      db.query.customers.findMany({
        where: () => whereClause,
        orderBy: (c, { desc }) => [desc(c.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count || 0);
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.tenantId, tenantId)),
    });
    if (!customer) throw errors.notFound('Customer');
    return customer;
  }

  async create(tenantId: string, data: typeof customers.$inferInsert) {
    const [customer] = await db.insert(customers).values({
      ...data,
      tenantId,
    }).returning();
    return customer;
  }

  async update(tenantId: string, id: string, data: Partial<typeof customers.$inferInsert>) {
    const [updated] = await db.update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Customer');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const [deleted] = await db.delete(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    if (!deleted) throw errors.notFound('Customer');
    return deleted;
  }
}

export const customersService = new CustomersService();
