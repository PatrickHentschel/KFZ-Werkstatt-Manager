import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { vehicles } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

export class VehiclesService {
  async list(tenantId: string, query: { page?: number; pageSize?: number; search?: string; customerId?: string }) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);

    let whereClause = eq(vehicles.tenantId, tenantId);

    if (query.customerId) {
      whereClause = and(whereClause, eq(vehicles.customerId, query.customerId)) as typeof whereClause;
    }

    if (query.search) {
      const search = `%${query.search}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(vehicles.licensePlate, search),
          ilike(vehicles.make, search),
          ilike(vehicles.model, search),
          ilike(vehicles.vin, search),
        )
      ) as typeof whereClause;
    }

    const [data, countResult] = await Promise.all([
      db.query.vehicles.findMany({
        where: () => whereClause,
        with: { customer: true },
        orderBy: (v, { desc }) => [desc(v.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(vehicles).where(whereClause),
    ]);

    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const vehicle = await db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)),
      with: { customer: true },
    });
    if (!vehicle) throw errors.notFound('Vehicle');
    return vehicle;
  }

  async create(tenantId: string, data: typeof vehicles.$inferInsert) {
    const [vehicle] = await db.insert(vehicles).values({ ...data, tenantId }).returning();
    return vehicle;
  }

  async update(tenantId: string, id: string, data: Partial<typeof vehicles.$inferInsert>) {
    const [updated] = await db.update(vehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Vehicle');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const [deleted] = await db.delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId)))
      .returning();
    if (!deleted) throw errors.notFound('Vehicle');
    return deleted;
  }
}

export const vehiclesService = new VehiclesService();
