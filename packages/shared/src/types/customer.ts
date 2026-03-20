export type CustomerType = 'private' | 'business';

export interface Customer {
  id: string;
  tenantId: string;
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  notes?: string;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;
