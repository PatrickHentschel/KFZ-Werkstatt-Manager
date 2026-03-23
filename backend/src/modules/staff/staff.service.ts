import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import { staff } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';

export class StaffService {
  async list(tenantId: string, query: any) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    const whereClause = eq(staff.tenantId, tenantId);

    const [data, countResult] = await Promise.all([
      db.query.staff.findMany({ where: () => whereClause, limit, offset }),
      db.select({ count: sql<number>`count(*)` }).from(staff).where(whereClause),
    ]);
    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }

  async getById(tenantId: string, id: string) {
    const member = await db.query.staff.findFirst({ where: and(eq(staff.id, id), eq(staff.tenantId, tenantId)) });
    if (!member) throw errors.notFound('Staff member');
    return member;
  }

  async create(tenantId: string, data: typeof staff.$inferInsert) {
    const [member] = await db.insert(staff).values({ ...data, tenantId }).returning();
    return member;
  }

  async update(tenantId: string, id: string, data: Partial<typeof staff.$inferInsert>) {
    const [updated] = await db.update(staff)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId)))
      .returning();
    if (!updated) throw errors.notFound('Staff member');
    return updated;
  }

}

export const staffService = new StaffService();
