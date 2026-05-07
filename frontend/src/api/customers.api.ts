import { apiClient } from './client';

export type Salutation = 'herr' | 'frau' | 'divers';

export interface Customer {
  id: string;
  tenantId: string;
  type: 'private' | 'business';
  salutation?: Salutation | null;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  birthDate?: string | null;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  postalCode?: string;
  country: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; totalPages: number; }

export const customersApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Customer>>('/customers', { params }),
  getById: (id: string) => apiClient.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => apiClient.post<Customer>('/customers', data),
  update: (id: string, data: Partial<Customer>) => apiClient.patch<Customer>(`/customers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/customers/${id}`),
};
