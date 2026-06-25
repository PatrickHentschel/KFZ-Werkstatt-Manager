import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { invoicesService } from './invoices.service';
import { db } from '../../db';
import { tenants } from '../../db/schema/tenants';
import { customers } from '../../db/schema/customers';
import { generateInvoicePdf } from '../../utils/pdf';
import { generateXRechnung, XRechnungError } from '../../utils/xrechnung';
import { getOrPersistDocument, readDocument } from '../../utils/invoice-storage';
import { sendEmail } from '../../utils/email';

const invoiceItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative(),
  unit: z.string().max(10).optional(),
  serviceDate: z.string().nullable().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountPercent: z.number().nonnegative().max(100).optional(),
  sortOrder: z.number().int().optional(),
});

const createInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).default('invoice'),
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  serviceDate: z.string().optional(),
  // dueDate: Pflicht. issueDate wird IMMER server-seitig gesetzt.
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fälligkeitsdatum ist Pflicht'),
  notes: z.string().optional(),
  skontoPercent: z.number().nonnegative().max(100).optional(),
  skontoDays: z.number().int().nonnegative().optional(),
  items: z.array(invoiceItemSchema),
});

const updateInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  serviceDate: z.string().nullable().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  orderId: z.string().uuid().optional(),
  skontoPercent: z.number().nonnegative().max(100).nullable().optional(),
  skontoDays: z.number().int().nonnegative().nullable().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

// Per-item schema for drafts — every field optional so half-typed items round-trip.
const draftItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  unit: z.string().max(10).optional(),
  serviceDate: z.string().nullable().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountPercent: z.number().nonnegative().max(100).optional(),
  sortOrder: z.number().int().optional(),
});

const draftInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  serviceDate: z.string().nullable().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  skontoPercent: z.number().nonnegative().max(100).nullable().optional(),
  skontoDays: z.number().int().nonnegative().nullable().optional(),
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

  // Storno: erzeugt Stornorechnung (credit_note) mit negativen Beträgen + ST-Nummer,
  // setzt Original auf 'cancelled'. Liefert die neue Stornorechnung.
  fastify.post('/:id/cancel', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storno = await invoicesService.cancelInvoice(request.user.tenantId, id);
    return reply.code(201).send(storno);
  });

  fastify.post('/:id/send', {
    preHandler: [fastify.requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    const initial = await invoicesService.getById(tenantId, id);

    if (!initial.customerId) {
      return reply.code(422).send({ statusCode: 422, error: 'Unprocessable Entity', message: 'Draft invoice has no customer assigned' });
    }

    const customer = await db.query.customers.findFirst({ where: eq(customers.id, initial.customerId) });
    if (!customer?.email) {
      return reply.code(422).send({ statusCode: 422, error: 'Unprocessable Entity', message: 'Customer has no email address' });
    }

    // Promote draft BEFORE rendering — sonst trägt das PDF noch die DRAFT-Nummer.
    const invoice = initial.status === 'draft'
      ? await invoicesService.updateStatus(tenantId, id, 'sent')
      : initial;

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    // §147 AO: PDF write-once persistieren. Re-Send liefert dieselbe Datei.
    const pdfBuffer = await getOrPersistDocument(
      tenantId, id, 'pdf',
      () => generateInvoicePdf(invoice as any, tenant!),
    );
    const customerName = customer.type === 'business'
      ? (customer.companyName || `${customer.firstName} ${customer.lastName}`)
      : `${customer.firstName || ''} ${customer.lastName || ''}`.trim();

    const attachments: Array<{ filename: string; content: Buffer | string; contentType: string }> = [
      {
        filename: `${invoice!.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    // XRechnung nur für B2B + echte Belege (keine Angebote). E-Rechnungspflicht
    // ab 2025 (Empfang) bzw. 2027/2028 (Versand). XRechnungError soll den
    // Mail-Versand nicht blockieren — PDF bleibt Primärformat.
    if (customer.type === 'business' && invoice!.type !== 'quote') {
      try {
        const xml = await getOrPersistDocument(
          tenantId, id, 'xrechnung',
          () => generateXRechnung(invoice as any, tenant!),
        );
        attachments.push({
          filename: `${invoice!.invoiceNumber}.xml`,
          content: xml,
          contentType: 'application/xml',
        });
      } catch (err) {
        const reason = err instanceof XRechnungError ? err.message : String(err);
        request.log.warn({ invoiceId: id, reason }, 'XRechnung-Anhang übersprungen');
      }
    }

    await sendEmail({
      to: customer.email,
      subject: `Ihre Rechnung ${invoice!.invoiceNumber} von ${tenant!.name}`,
      html: `
        <p>Sehr geehrte/r ${customerName},</p>
        <p>im Anhang finden Sie Ihre Rechnung <strong>${invoice!.invoiceNumber}</strong>.</p>
        ${invoice!.dueDate ? `<p>Zahlbar bis: ${new Date(invoice!.dueDate).toLocaleDateString('de-DE')}</p>` : ''}
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Mit freundlichen Grüßen,<br>${tenant!.name}</p>
      `,
      attachments,
    });

    return reply.code(204).send();
  });

  // GET /:id/pdf:
  //   - festgeschriebener Beleg (sent/paid/cancelled): aus Archiv lesen (§147 AO)
  //   - Draft/Quote: live-Render (Vorschau)
  fastify.get('/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;
    const invoice = await invoicesService.getById(tenantId, id);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });

    const archived = invoice.status !== 'draft'
      ? await readDocument(tenantId, id, 'pdf')
      : null;
    const pdfBuffer = archived ?? await generateInvoicePdf(invoice, tenant!);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
      .send(pdfBuffer);
  });

  // GET /:id/xrechnung — UBL 2.1 / XRechnung 3.0 XML.
  // Pflicht für DE-B2G; ab 2025/2027 schrittweise auch B2B.
  // Drafts (issueDate=null) und Angebote sind ausgeschlossen — XRechnungError → 422.
  // Festgeschriebene Belege: archivierte Version (§147 AO), sonst live-Render.
  fastify.get('/:id/xrechnung', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;
    const invoice = await invoicesService.getById(tenantId, id);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });

    try {
      const archived = invoice.status !== 'draft'
        ? await readDocument(tenantId, id, 'xrechnung')
        : null;
      const xml = archived ?? generateXRechnung(invoice as any, tenant!);

      return reply
        .header('Content-Type', 'application/xml; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xml"`)
        .send(xml);
    } catch (err) {
      if (err instanceof XRechnungError) {
        return reply.code(422).send({ statusCode: 422, error: 'Unprocessable Entity', message: err.message });
      }
      throw err;
    }
  });
};

export default invoicesRoutes;
