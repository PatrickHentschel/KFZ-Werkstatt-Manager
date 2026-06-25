import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { staffService } from './staff.service';

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().default('Techniker'),
  hourlyRate: z.number().nonnegative().optional(),
  costRate: z.number().nonnegative().optional(),
  color: z.string().optional(),
});

const staffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireRole('owner', 'admin'));

  fastify.get('/', async (request) => staffService.list(request.user.tenantId, request.query));
  fastify.get('/:id', async (request) => staffService.getById(request.user.tenantId, (request.params as any).id));

  fastify.post('/', async (request, reply) => {
    const body = createStaffSchema.parse(request.body);
    const member = await staffService.create(request.user.tenantId, body as any);
    return reply.code(201).send(member);
  });

  fastify.patch('/:id', async (request) => {
    const body = createStaffSchema.partial().parse(request.body);
    return staffService.update(request.user.tenantId, (request.params as any).id, body as any);
  });

};

export default staffRoutes;
