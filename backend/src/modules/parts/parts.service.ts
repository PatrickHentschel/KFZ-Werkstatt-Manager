import { eq, and, ilike, or, sql, lte } from 'drizzle-orm';
import { db } from '../../db';
import { parts, vendors } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

export class PartsService {
  async list(tenantId: string, query: { page?: number; pageSize?: number; search?: string; lowStock?: boolean }) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    let whereClause = eq(parts.tenantId, tenantId);

    if (query.search) {
      const search = `%${query.search}%`;
      whereClause = and(whereClause, or(
        ilike(parts.name, search),
        ilike(parts.sku, search),
        ilike(parts.oemNumber, search),
      )) as typeof whereClause;
    }

    if (query.lowStock) {
      whereClause = and(whereClause, lte(parts.stockQuantity, parts.minStock)) as typeof whereClause;
    }

    const [data, countResult] = await Promise.all([
      db.query.parts.findMany({
        where: () => whereClause,
        with: { vendor: true },
        orderBy: (p, { asc }) => [asc(p.name)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(parts).where(whereClause),
    ]);

    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const part = await db.query.parts.findFirst({
      where: and(eq(parts.id, id), eq(parts.tenantId, tenantId)),
      with: { vendor: true },
    });
    if (!part) throw errors.notFound('Part');
    return part;
  }

  async create(tenantId: string, data: typeof parts.$inferInsert) {
    const [part] = await db.insert(parts).values({ ...data, tenantId }).returning();
    return part;
  }

  async update(tenantId: string, id: string, data: Partial<typeof parts.$inferInsert>) {
    const [updated] = await db.update(parts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(parts.id, id), eq(parts.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Part');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const [deleted] = await db.delete(parts)
      .where(and(eq(parts.id, id), eq(parts.tenantId, tenantId)))
      .returning();
    if (!deleted) throw errors.notFound('Part');
    return deleted;
  }

  async adjustStock(tenantId: string, id: string, adjustment: number, reason?: string) {
    const part = await this.getById(tenantId, id);
    const newQty = Number(part.stockQuantity) + adjustment;
    if (newQty < 0) throw errors.badRequest('Stock quantity cannot go below zero');
    return this.update(tenantId, id, { stockQuantity: String(newQty) });
  }
}

export const partsService = new PartsService();

export class VendorsService {
  async list(tenantId: string, query: { page?: number; pageSize?: number }) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    const whereClause = eq(vendors.tenantId, tenantId);

    const [data, countResult] = await Promise.all([
      db.query.vendors.findMany({ where: () => whereClause, limit, offset }),
      db.select({ count: sql<number>`count(*)` }).from(vendors).where(whereClause),
    ]);
    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async create(tenantId: string, data: typeof vendors.$inferInsert) {
    const [vendor] = await db.insert(vendors).values({ ...data, tenantId }).returning();
    return vendor;
  }

  async update(tenantId: string, id: string, data: Partial<typeof vendors.$inferInsert>) {
    const [updated] = await db.update(vendors)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Vendor');
    return updated;
  }

  async delete(tenantId: string, id: string) {
    const [deleted] = await db.delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
      .returning();
    if (!deleted) throw errors.notFound('Vendor');
    return deleted;
  }
}

export const vendorsService = new VendorsService();
