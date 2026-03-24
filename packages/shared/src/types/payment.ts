export type PaymentMode = 'demo' | 'stripe';

export interface PaymentConfig {
  mode: PaymentMode;
  publishableKey?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  mode: PaymentMode;
}
