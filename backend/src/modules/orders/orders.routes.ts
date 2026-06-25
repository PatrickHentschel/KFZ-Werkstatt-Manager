import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ordersService } from './orders.service';
import { invoicesService } from '../invoices/invoices.service';

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  description: z.string().optional(),
  mileageIn: z.number().int().optional(),
  estimatedDone: z.string().optional(),
  notes: z.string().optional(),
  assignedStaffId: z.string().uuid().optional(),
  // Skonto: kein Pflichtfeld, Default 0.
  skontoPercent: z.number().nonnegative().max(100).optional(),
  skontoDays: z.number().int().nonnegative().optional(),
});

const orderItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  unit: z.string().max(10).optional(),
  partId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
  // Rabatt: kein Pflichtfeld, Default 0.
  discountAmount: z.number().nonnegative().optional(),
  discountPercent: z.number().nonnegative().max(100).optional(),
});

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    return ordersService.list(request.user.tenantId, request.query as any);
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return ordersService.getById(request.user.tenantId, id);
  });

  fastify.post('/', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const order = await ordersService.create(request.user.tenantId, body);
    return reply.code(201).send(order);
  });

  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createOrderSchema.omit({ customerId: true, vehicleId: true }).partial().parse(request.body);
    return ordersService.update(request.user.tenantId, id, body as any);
  });

  fastify.patch('/:id/status', async (request) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.enum(['open', 'in_progress', 'waiting_parts', 'done', 'invoiced']) }).parse(request.body);
    return ordersService.updateStatus(request.user.tenantId, id, status);
  });

  fastify.put('/:id/items', {
    preHandler: [fastify.requireRole('owner', 'admin', 'technician')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { items } = z.object({ items: z.array(orderItemSchema) }).parse(request.body);
    return ordersService.updateItems(request.user.tenantId, id, items);
  });

  fastify.get('/:id/time-entries', async (request) => {
    const { id } = request.params as { id: string };
    return ordersService.listTimeEntries(request.user.tenantId, id);
  });

  fastify.post('/:id/time-entries', {
    preHandler: [fastify.requireRole('owner', 'admin', 'technician')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      staffId: z.string().uuid(),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive(),
    }).parse(request.body);
    const entry = await ordersService.addTimeEntry(request.user.tenantId, id, body);
    return reply.code(201).send(entry);
  });

  fastify.post('/:id/invoice', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await invoicesService.createFromOrder(request.user.tenantId, id);
    await ordersService.updateStatus(request.user.tenantId, id, 'invoiced');
    return reply.code(201).send(invoice);
  });
};

export default ordersRoutes;
