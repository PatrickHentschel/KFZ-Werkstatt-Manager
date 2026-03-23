import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export interface Part {
  id: string; tenantId: string; sku: string; oemNumber?: string;
  name: string; description?: string; category?: string;
  stockQuantity: number; minStock: number; unit: string;
  purchasePrice: number; salePrice: number; taxRate: number;
  vendorId?: string; location?: string;
  vendor?: { id: string; name: string };
  createdAt: string; updatedAt: string;
}

export interface Vendor {
  id: string; tenantId: string; name: string; email?: string;
  phone?: string; address?: string; contactPerson?: string; notes?: string;
}

export const partsApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; lowStock?: boolean }) =>
    apiClient.get<PaginatedResponse<Part>>('/parts', { params }),
  getById: (id: string) => apiClient.get<Part>(`/parts/${id}`),
  create: (data: Partial<Part>) => apiClient.post<Part>('/parts', data),
  update: (id: string, data: Partial<Part>) => apiClient.patch<Part>(`/parts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/parts/${id}`),
  adjustStock: (id: string, adjustment: number, reason?: string) =>
    apiClient.patch(`/parts/${id}/stock`, { adjustment, reason }),
  listVendors: () => apiClient.get<PaginatedResponse<Vendor>>('/parts/vendors'),
  createVendor: (data: Partial<Vendor>) => apiClient.post<Vendor>('/parts/vendors', data),
  updateVendor: (id: string, data: Partial<Vendor>) => apiClient.patch<Vendor>(`/parts/vendors/${id}`, data),
  deleteVendor: (id: string) => apiClient.delete(`/parts/vendors/${id}`),
};
