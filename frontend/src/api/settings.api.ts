import { apiClient } from './client';

export interface TenantSettings {
  id: string; name: string; email: string; phone?: string;
  address?: string; city?: string;
  taxId?: string; taxRate: number; invoicePrefix: string;
  invoiceCounter: number; plan: string; logoUrl?: string;
}

export const settingsApi = {
  get: () => apiClient.get<TenantSettings>('/settings'),
  update: (data: Partial<TenantSettings>) => apiClient.patch<TenantSettings>('/settings', data),
};
