import { apiClient } from './client';

export interface TenantSettings {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  taxId?: string;
  taxRate: number;
  isSmallBusiness: boolean;
  iban?: string;
  bic?: string;
  bankName?: string;
  invoicePrefix: string;
  invoiceCounter: number;
  plan: string;
  logoUrl?: string;
  awMinutes: number;
}

export const settingsApi = {
  get: () => apiClient.get<TenantSettings>('/settings'),
  update: (data: Partial<TenantSettings>) => apiClient.patch<TenantSettings>('/settings', data),
};
