import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { customersService } from './customers.service';

const createCustomerSchema = z.object({
  type: z.enum(['private', 'business']).default('private'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2).default('AT'),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

const customersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request, reply) => {
    const query = request.query as { page?: number; pageSize?: number; search?: string };
    return customersService.list(request.user.tenantId, query);
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return customersService.getById(request.user.tenantId, id);
  });

  fastify.post('/', async (request, reply) => {
    const body = createCustomerSchema.parse(request.body);
    const customer = await customersService.create(request.user.tenantId, body as any);
    return reply.code(201).send(customer);
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createCustomerSchema.partial().parse(request.body);
    return customersService.update(request.user.tenantId, id, body as any);
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await customersService.delete(request.user.tenantId, id);
    return reply.code(204).send();
  });
};

export default customersRoutes;
