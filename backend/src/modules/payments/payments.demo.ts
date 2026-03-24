import type { PaymentProvider, CheckoutSession, CreateCheckoutParams } from './payments.provider';

export class DemoPaymentProvider implements PaymentProvider {
  getMode(): 'demo' {
    return 'demo';
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const sessionId = `demo_${params.invoiceId}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${frontendUrl}/demo-checkout?session=${sessionId}&invoice=${params.invoiceId}`;
    return { sessionId, url, mode: 'demo' };
  }
}
