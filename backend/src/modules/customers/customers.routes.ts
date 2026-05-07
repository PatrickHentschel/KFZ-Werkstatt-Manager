import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { customersService } from './customers.service';
import { taxIdSchema, postalCodeDeSchema, phoneDeSchema } from '../../utils/validators';

// Hausnummer: Ziffern + optional Buchstabe(n) + optional Bereich (12, 12a, 12-14, 12 a)
const HOUSE_NUMBER_RE = /^[0-9]{1,5}[a-zA-Z]?(\s?[-/]\s?[0-9]{1,5}[a-zA-Z]?)?$/;
const houseNumberSchema = z.string().trim().refine(
  v => v === '' || HOUSE_NUMBER_RE.test(v),
  { message: 'Ungültige Hausnummer' },
);

const createCustomerSchema = z.object({
  type: z.enum(['private', 'business']).default('private'),
  salutation: z.enum(['herr', 'frau', 'divers']).nullable().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').nullable().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: phoneDeSchema.optional(),
  mobile: phoneDeSchema.optional(),
  street: z.string().optional(),
  houseNumber: houseNumberSchema.optional(),
  city: z.string().optional(),
  postalCode: postalCodeDeSchema.optional(),
  taxId: taxIdSchema.optional(),
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

  fastify.post('/', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const body = createCustomerSchema.parse(request.body);
    const customer = await customersService.create(request.user.tenantId, body as any);
    return reply.code(201).send(customer);
  });

  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createCustomerSchema.partial().parse(request.body);
    return customersService.update(request.user.tenantId, id, body as any);
  });

  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await customersService.delete(request.user.tenantId, id);
    return reply.code(204).send();
  });
};

export default customersRoutes;
