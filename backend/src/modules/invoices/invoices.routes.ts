import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { invoicesService } from './invoices.service';
import { db } from '../../db';
import { tenants } from '../../db/schema/tenants';
import { generateInvoicePdf } from '../../utils/pdf';

const invoiceItemSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  sortOrder: z.number().int().optional(),
});

const createInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).default('invoice'),
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema),
});

const updateInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  orderId: z.string().uuid().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    return invoicesService.list(request.user.tenantId, request.query);
  });

  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return invoicesService.getById(request.user.tenantId, id);
  });

  fastify.post('/', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = createInvoiceSchema.parse(request.body);
    const invoice = await invoicesService.create(request.user.tenantId, body);
    return reply.code(201).send(invoice);
  });

  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateInvoiceSchema.parse(request.body);
    return invoicesService.update(request.user.tenantId, id, body);
  });

  fastify.patch('/:id/status', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.enum(['draft', 'sent', 'paid', 'cancelled']) }).parse(request.body);
    return invoicesService.updateStatus(request.user.tenantId, id, status);
  });

  fastify.get('/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;
    const invoice = await invoicesService.getById(tenantId, id);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    const pdfBuffer = await generateInvoicePdf(invoice, tenant!);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
      .send(pdfBuffer);
  });
};

export default invoicesRoutes;
