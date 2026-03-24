import { apiClient } from './client';
import type { Invoice } from './invoices.api';

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

export const paymentsApi = {
  getConfig: () =>
    apiClient.get<PaymentConfig>('/payments/config'),

  createCheckout: (invoiceId: string) =>
    apiClient.post<CheckoutSessionResponse>(`/payments/checkout/${invoiceId}`),

  confirmDemo: (invoiceId: string, sessionId: string) =>
    apiClient.post<Invoice>('/payments/confirm-demo', { invoiceId, sessionId }),

  verifySuccess: (sessionId: string) =>
    apiClient.get<Invoice>(`/payments/success?session_id=${sessionId}`),
};
