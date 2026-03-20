export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  taxId?: string;
  taxRate: number;
  invoicePrefix: string;
  invoiceCounter: number;
  plan: TenantPlan;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type TenantPlan = 'trial' | 'starter' | 'professional' | 'enterprise';

export interface UpdateTenantRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  taxRate?: number;
  invoicePrefix?: string;
}
