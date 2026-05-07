import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { vehiclesService } from './vehicles.service';

const HSN_RE = /^[0-9]{4}$/;
const TSN_RE = /^[A-Z0-9]{3}$/;

const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  licensePlate: z.string().min(1).max(20),
  vin: z.string().length(17).optional().or(z.literal('')),
  hsn: z.string().refine(v => !v || HSN_RE.test(v), 'HSN: 4 Ziffern').optional().or(z.literal('')),
  tsn: z.string().refine(v => !v || TSN_RE.test(v.toUpperCase()), 'TSN: 3 alphanumerisch').optional().or(z.literal('')),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  firstRegistration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional().or(z.literal('')),
  color: z.string().optional(),
  engineDisplacement: z.number().int().optional(),
  fuelType: z.enum(['benzin', 'diesel', 'elektro', 'hybrid', 'lpg', 'cng', 'sonstige']).optional(),
  transmission: z.enum(['manual', 'automatic', 'semi_automatic']).optional(),
  mileage: z.number().int().nonnegative(),
  nextTuvDate: z.string().optional(),
  notes: z.string().optional(),
});

const vehiclesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const query = request.query as any;
    return vehiclesService.list(request.user.tenantId, query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return vehiclesService.getById(request.user.tenantId, id);
  });

  fastify.post('/', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const body = createVehicleSchema.parse(request.body);
    const vehicle = await vehiclesService.create(request.user.tenantId, body as any);
    return reply.code(201).send(vehicle);
  });

  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = createVehicleSchema.omit({ customerId: true }).partial().parse(request.body);
    return vehiclesService.update(request.user.tenantId, id, body as any);
  });

  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await vehiclesService.delete(request.user.tenantId, id);
    return reply.code(204).send();
  });
};

export default vehiclesRoutes;
