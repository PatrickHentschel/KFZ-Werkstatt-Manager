import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { partsService, vendorsService } from './parts.service';

const createPartSchema = z.object({
  sku: z.string().min(1),
  oemNumber: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  stockQuantity: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  unit: z.string().default('Stk'),
  purchasePrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().default(20),
  vendorId: z.string().uuid().optional(),
  location: z.string().optional(),
});

const partsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // Parts
  fastify.get('/', async (request) => partsService.list(request.user.tenantId, request.query as any));
  fastify.get('/:id', async (request) => partsService.getById(request.user.tenantId, (request.params as any).id));
  fastify.post('/', async (request, reply) => {
    const body = createPartSchema.parse(request.body);
    const part = await partsService.create(request.user.tenantId, {
      ...body,
      stockQuantity: String(body.stockQuantity),
      minStock: String(body.minStock),
      purchasePrice: String(body.purchasePrice),
      salePrice: String(body.salePrice),
      taxRate: String(body.taxRate),
    } as any);
    return reply.code(201).send(part);
  });
  fastify.patch('/:id', async (request) => {
    const body = createPartSchema.partial().parse(request.body);
    return partsService.update(request.user.tenantId, (request.params as any).id, body as any);
  });
  fastify.delete('/:id', async (request, reply) => {
    await partsService.delete(request.user.tenantId, (request.params as any).id);
    return reply.code(204).send();
  });
  fastify.patch('/:id/stock', async (request) => {
    const { adjustment, reason } = z.object({ adjustment: z.number(), reason: z.string().optional() }).parse(request.body);
    return partsService.adjustStock(request.user.tenantId, (request.params as any).id, adjustment, reason);
  });

  // Vendors
  fastify.get('/vendors', async (request) => vendorsService.list(request.user.tenantId, request.query as any));
  fastify.post('/vendors', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      notes: z.string().optional(),
    }).parse(request.body);
    const vendor = await vendorsService.create(request.user.tenantId, body as any);
    return reply.code(201).send(vendor);
  });
  fastify.patch('/vendors/:id', async (request) => {
    const body = z.object({ name: z.string().optional(), email: z.string().optional(), phone: z.string().optional() }).parse(request.body);
    return vendorsService.update(request.user.tenantId, (request.params as any).id, body as any);
  });
  fastify.delete('/vendors/:id', async (request, reply) => {
    await vendorsService.delete(request.user.tenantId, (request.params as any).id);
    return reply.code(204).send();
  });
};

export default partsRoutes;
