import { apiClient } from './client';

export interface Customer {
  id: string; tenantId: string; type: 'private' | 'business';
  firstName?: string; lastName?: string; companyName?: string;
  email?: string; phone?: string; mobile?: string;
  address?: string; city?: string; postalCode?: string; country: string;
  taxId?: string; notes?: string; createdAt: string; updatedAt: string;
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
