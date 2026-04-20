import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { invoicesService } from './invoices.service';
import { db } from '../../db';
import { tenants } from '../../db/schema/tenants';
import { customers } from '../../db/schema/customers';
import { generateInvoicePdf } from '../../utils/pdf';
import { sendEmail } from '../../utils/email';

const invoiceItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  unit: z.string().max(10).optional(),
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

// Per-item schema for drafts — every field optional so half-typed items round-trip.
// Note: items missing `description` are filtered server-side (invoice_items.description is NOT NULL).
const draftItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  unit: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
});

// Per D-04: every field optional. Per D-03: PATCH uses the same shape.
const draftInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(draftItemSchema).optional(),
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

  // POST /api/v1/invoices/draft — per D-01, D-02, D-04.
  // Roles: owner, admin, reception (D-07 — technicians excluded).
  // Returns 201 with full invoice object (D-02) so frontend can store the id.
  fastify.post('/draft', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const body = draftInvoiceSchema.parse(request.body);
    const draft = await invoicesService.createDraft(request.user.tenantId, body);
    return reply.code(201).send(draft);
  });

  // PATCH /api/v1/invoices/draft/:id — per D-01, D-03 (partial merge).
  // Same role gate as POST /draft (D-07).
  // Returns 200 (default) with updated invoice. 404 if id missing, 400 if invoice exists but is not a draft.
  fastify.patch('/draft/:id', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = draftInvoiceSchema.parse(request.body);
    return invoicesService.updateDraft(request.user.tenantId, id, body);
  });

  // DELETE /api/v1/invoices/draft/:id — removes draft + items. 404 if not found, 400 if not a draft.
  fastify.delete('/draft/:id', {
    preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await invoicesService.deleteDraft(request.user.tenantId, id);
    return reply.code(204).send();
  });

  fastify.patch('/:id/status', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.enum(['draft', 'sent', 'paid', 'cancelled']) }).parse(request.body);
    return invoicesService.updateStatus(request.user.tenantId, id, status);
  });

  fastify.post('/:id/send', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    const invoice = await invoicesService.getById(tenantId, id);

    if (!invoice.customerId) {
      return reply.code(422).send({ statusCode: 422, error: 'Unprocessable Entity', message: 'Draft invoice has no customer assigned' });
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    const customer = await db.query.customers.findFirst({ where: eq(customers.id, invoice.customerId) });

    if (!customer?.email) {
      return reply.code(422).send({ statusCode: 422, error: 'Unprocessable Entity', message: 'Customer has no email address' });
    }

    const pdfBuffer = await generateInvoicePdf(invoice, tenant!);
    const customerName = customer.type === 'business'
      ? (customer.companyName || `${customer.firstName} ${customer.lastName}`)
      : `${customer.firstName || ''} ${customer.lastName || ''}`.trim();

    await sendEmail({
      to: customer.email,
      subject: `Ihre Rechnung ${invoice.invoiceNumber} von ${tenant!.name}`,
      html: `
        <p>Sehr geehrte/r ${customerName},</p>
        <p>im Anhang finden Sie Ihre Rechnung <strong>${invoice.invoiceNumber}</strong>.</p>
        ${invoice.dueDate ? `<p>Zahlbar bis: ${new Date(invoice.dueDate).toLocaleDateString('de-AT')}</p>` : ''}
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Mit freundlichen Grüßen,<br>${tenant!.name}</p>
      `,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (invoice.status === 'draft') {
      await invoicesService.updateStatus(tenantId, id, 'sent');
    }

    return reply.code(204).send();
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
