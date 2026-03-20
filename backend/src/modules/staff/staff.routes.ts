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
  color: z.string().optional(),
});

const staffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => staffService.list(request.user.tenantId, request.query));
  fastify.get('/:id', async (request) => staffService.getById(request.user.tenantId, (request.params as any).id));

  fastify.post('/', async (request, reply) => {
    const body = createStaffSchema.parse(request.body);
    const member = await staffService.create(request.user.tenantId, {
      ...body,
      hourlyRate: body.hourlyRate ? String(body.hourlyRate) : undefined,
    } as any);
    return reply.code(201).send(member);
  });

  fastify.patch('/:id', async (request) => {
    const body = createStaffSchema.partial().parse(request.body);
    return staffService.update(request.user.tenantId, (request.params as any).id, body as any);
  });

  // Time tracking
  fastify.post('/:id/timer/start', async (request, reply) => {
    const { orderId, description } = z.object({ orderId: z.string().uuid().optional(), description: z.string().optional() }).parse(request.body || {});
    const entry = await staffService.startTimer(request.user.tenantId, (request.params as any).id, orderId, description);
    return reply.code(201).send(entry);
  });

  fastify.post('/:id/timer/stop', async (request) => {
    return staffService.stopTimer(request.user.tenantId, (request.params as any).id);
  });

  fastify.get('/:id/time-entries', async (request) => {
    return staffService.listTimeEntries(request.user.tenantId, (request.params as any).id, request.query);
  });

  fastify.delete('/:id/time-entries/:entryId', async (request, reply) => {
    await staffService.deleteTimeEntry(request.user.tenantId, (request.params as any).entryId);
    return reply.code(204).send();
  });
};

export default staffRoutes;
