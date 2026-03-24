import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, invoiceItems } from '../../db/schema';
import { errors } from '../../utils/errors';
import { config, isStripeEnabled } from '../../config';
import { createPaymentProvider } from './payments.provider';
import type { PaymentProvider } from './payments.provider';

let _provider: PaymentProvider | null = null;

async function getProvider(): Promise<PaymentProvider> {
  if (!_provider) {
    _provider = await createPaymentProvider();
  }
  return _provider;
}

export class PaymentsService {
  getPaymentConfig() {
    return {
      mode: isStripeEnabled() ? ('stripe' as const) : ('demo' as const),
      publishableKey: isStripeEnabled() ? config.stripePublishableKey : undefined,
    };
  }

  async createCheckoutSession(tenantId: string, invoiceId: string) {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
      with: { items: true },
    });

    if (!invoice) throw errors.notFound('Invoice');
    if (invoice.status !== 'sent') {
      throw errors.badRequest('Nur versendete Rechnungen können bezahlt werden');
    }

    const amountCents = invoice.items.reduce((sum, item) => {
      const net = Number(item.quantity) * Number(item.unitPrice);
      const gross = net * (1 + Number(item.taxRate) / 100);
      return sum + Math.round(gross * 100);
    }, 0);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const successUrl = `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&invoice=${invoiceId}`;
    const cancelUrl = `${frontendUrl}/invoices`;

    const provider = await getProvider();
    const session = await provider.createCheckoutSession({
      invoiceId,
      tenantId,
      invoiceNumber: invoice.invoiceNumber,
      amountCents,
      currency: 'eur',
      successUrl,
      cancelUrl,
    });

    await db.update(invoices)
      .set({ stripeCheckoutSessionId: session.sessionId, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    return session;
  }

  async confirmDemoPayment(tenantId: string, invoiceId: string, sessionId: string) {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
    });

    if (!invoice) throw errors.notFound('Invoice');
    if (invoice.stripeCheckoutSessionId !== sessionId) {
      throw errors.badRequest('Ungültige Session');
    }
    if (invoice.status === 'paid') {
      return db.query.invoices.findFirst({
        where: eq(invoices.id, invoiceId),
        with: { customer: true, items: true },
      });
    }

    await db.update(invoices)
      .set({ status: 'paid', paidAt: new Date(), paymentMethod: 'demo', updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

    return db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: { customer: true, items: true },
    });
  }

  async confirmStripePayment(sessionId: string) {
    // Find the invoice without RLS tenant context (webhook has no JWT)
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.stripeCheckoutSessionId, sessionId),
    });

    if (!invoice) throw errors.notFound('Invoice for session');
    if (invoice.status === 'paid') return; // idempotent

    // Set tenant RLS context manually before writing
    await db.execute(sql`SELECT set_config('app.current_tenant_id', ${invoice.tenantId}, false)`);

    await db.update(invoices)
      .set({ status: 'paid', paidAt: new Date(), paymentMethod: 'stripe', updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  }

  async getBySessionId(tenantId: string, sessionId: string) {
    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.stripeCheckoutSessionId, sessionId),
        eq(invoices.tenantId, tenantId),
      ),
      with: { customer: true, items: true },
    });
    if (!invoice) throw errors.notFound('Invoice');
    return invoice;
  }
}

export const paymentsService = new PaymentsService();
