import Stripe from 'stripe';
import type { PaymentProvider, CheckoutSession, CreateCheckoutParams } from './payments.provider';

export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  }

  getMode(): 'stripe' {
    return 'stripe';
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: { name: `Rechnung ${params.invoiceNumber}` },
            unit_amount: params.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        invoiceId: params.invoiceId,
        tenantId: params.tenantId,
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
      mode: 'stripe',
    };
  }

  constructWebhookEvent(payload: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
