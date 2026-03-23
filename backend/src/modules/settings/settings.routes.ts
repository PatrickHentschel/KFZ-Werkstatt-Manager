import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { tenants } from '../../db/schema';
import { errors } from '../../utils/errors';

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // Get tenant settings
  fastify.get('/', async (request) => {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, request.user.tenantId),
    });
    if (!tenant) throw errors.notFound('Tenant');
    return tenant;
  });

  // Update tenant settings
  fastify.patch('/', async (request) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      taxId: z.string().optional(),
      taxRate: z.number().min(0).max(100).optional(),
      invoicePrefix: z.string().max(20).optional(),
    });

    const body = schema.parse(request.body);
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.city !== undefined) updates.city = body.city;
    if (body.taxId !== undefined) updates.taxId = body.taxId;
    if (body.taxRate !== undefined) updates.taxRate = String(body.taxRate);
    if (body.invoicePrefix) updates.invoicePrefix = body.invoicePrefix;

    const [updated] = await db.update(tenants)
      .set(updates)
      .where(eq(tenants.id, request.user.tenantId))
      .returning();

    return updated;
  });
};

export default settingsRoutes;
