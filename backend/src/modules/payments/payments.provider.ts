import { config, isStripeEnabled } from '../../config';

export interface CheckoutSession {
  sessionId: string;
  url: string;
  mode: 'demo' | 'stripe';
}

export interface CreateCheckoutParams {
  invoiceId: string;
  tenantId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
  getMode(): 'demo' | 'stripe';
}

export async function createPaymentProvider(): Promise<PaymentProvider> {
  if (isStripeEnabled()) {
    const { StripePaymentProvider } = await import('./payments.stripe');
    return new StripePaymentProvider(config.stripeSecretKey!);
  }
  const { DemoPaymentProvider } = await import('./payments.demo');
  return new DemoPaymentProvider();
}
