import { eq, and, sql, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { staff, timeEntries } from '../../db/schema';
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

  // Time entries
  async startTimer(tenantId: string, staffId: string, orderId?: string, description?: string) {
    // Check for running timer
    const running = await db.query.timeEntries.findFirst({
      where: and(eq(timeEntries.staffId, staffId), eq(timeEntries.tenantId, tenantId), isNull(timeEntries.endTime)),
    });
    if (running) throw errors.conflict('A timer is already running for this staff member');

    const [entry] = await db.insert(timeEntries).values({
      tenantId, staffId, orderId, description,
      startTime: new Date(),
      isManual: false,
    }).returning();
    return entry;
  }

  async stopTimer(tenantId: string, staffId: string) {
    const running = await db.query.timeEntries.findFirst({
      where: and(eq(timeEntries.staffId, staffId), eq(timeEntries.tenantId, tenantId), isNull(timeEntries.endTime)),
    });
    if (!running) throw errors.notFound('No running timer');

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - running.startTime.getTime()) / 60000);

    const [updated] = await db.update(timeEntries)
      .set({ endTime, durationMinutes })
      .where(eq(timeEntries.id, running.id))
      .returning();
    return updated;
  }

  async listTimeEntries(tenantId: string, staffId: string, query: any) {
    const { page, pageSize, offset, limit } = getPaginationParams(query);
    const whereClause = and(eq(timeEntries.tenantId, tenantId), eq(timeEntries.staffId, staffId));

    const [data, countResult] = await Promise.all([
      db.query.timeEntries.findMany({ where: () => whereClause!, limit, offset, orderBy: (t, { desc }) => [desc(t.startTime)] }),
      db.select({ count: sql<number>`count(*)` }).from(timeEntries).where(whereClause),
    ]);
    return buildPaginatedResponse(data, Number(countResult[0]?.count || 0), page, pageSize);
  }
  async deleteTimeEntry(tenantId: string, entryId: string) {
    const [deleted] = await db.delete(timeEntries)
      .where(and(eq(timeEntries.id, entryId), eq(timeEntries.tenantId, tenantId)))
      .returning();
    if (!deleted) throw errors.notFound('Time entry');
    return deleted;
  }
}

export const staffService = new StaffService();
