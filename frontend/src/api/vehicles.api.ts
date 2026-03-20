import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export interface Vehicle {
  id: string; tenantId: string; customerId: string;
  licensePlate: string; vin?: string; make: string; model: string;
  year?: number; color?: string; fuelType?: string; mileage?: number;
  nextTuvDate?: string; nextPickerlDate?: string; notes?: string;
  customer?: { id: string; firstName?: string; lastName?: string; companyName?: string; };
  createdAt: string; updatedAt: string;
}

export const vehiclesApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; customerId?: string }) =>
    apiClient.get<PaginatedResponse<Vehicle>>('/vehicles', { params }),
  getById: (id: string) => apiClient.get<Vehicle>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => apiClient.post<Vehicle>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) => apiClient.patch<Vehicle>(`/vehicles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/vehicles/${id}`),
};
