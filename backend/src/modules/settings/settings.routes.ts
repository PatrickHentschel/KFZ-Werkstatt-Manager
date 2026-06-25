import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { tenants } from '../../db/schema';
import { errors } from '../../utils/errors';
import { taxIdSchema, ibanSchema, bicSchema, postalCodeDeSchema, phoneDeSchema } from '../../utils/validators';

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
  fastify.patch('/', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: phoneDeSchema.optional(),
      address: z.string().optional(),
      postalCode: postalCodeDeSchema.optional(),
      city: z.string().optional(),
      taxId: taxIdSchema.optional(),
      taxRate: z.number().refine(v => [19, 0].includes(v), { message: 'MwSt-Satz muss 19 oder 0 sein' }).optional(),
      isSmallBusiness: z.boolean().optional(),
      iban: ibanSchema.optional(),
      bic: bicSchema.optional(),
      bankName: z.string().max(255).optional(),
      invoicePrefix: z.string().max(20).optional(),
      awMinutes: z.number().int().min(1).max(60).optional(),
      awRate: z.number().nonnegative().optional(),
    });

    const body = schema.parse(request.body);
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.postalCode !== undefined) updates.postalCode = body.postalCode;
    if (body.city !== undefined) updates.city = body.city;
    if (body.taxId !== undefined) updates.taxId = body.taxId;
    if (body.taxRate !== undefined) updates.taxRate = body.taxRate;
    if (body.isSmallBusiness !== undefined) updates.isSmallBusiness = body.isSmallBusiness;
    if (body.iban !== undefined) updates.iban = body.iban.replace(/\s/g, '').toUpperCase();
    if (body.bic !== undefined) updates.bic = body.bic.toUpperCase();
    if (body.bankName !== undefined) updates.bankName = body.bankName;
    if (body.invoicePrefix) updates.invoicePrefix = body.invoicePrefix;
    if (body.awMinutes !== undefined) updates.awMinutes = body.awMinutes;
    if (body.awRate !== undefined) updates.awRate = body.awRate;

    const [updated] = await db.update(tenants)
      .set(updates)
      .where(eq(tenants.id, request.user.tenantId))
      .returning();

    return updated;
  });
};

export default settingsRoutes;
