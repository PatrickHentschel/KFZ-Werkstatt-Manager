import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { vehiclesService } from './vehicles.service';

const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  licensePlate: z.string().min(1).max(20),
  vin: z.string().length(17).optional(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().optional(),
  engineDisplacement: z.number().int().optional(),
  fuelType: z.enum(['gasoline', 'diesel', 'electric', 'hybrid', 'lpg', 'cng', 'other']).optional(),
  mileage: z.number().int().optional(),
  nextTuvDate: z.string().optional(),
  nextPickerlDate: z.string().optional(),
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
