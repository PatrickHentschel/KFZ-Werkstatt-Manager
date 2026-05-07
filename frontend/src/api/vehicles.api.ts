import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export type Transmission = 'manual' | 'automatic' | 'semi_automatic';

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  licensePlate: string;
  vin?: string;
  hsn?: string;
  tsn?: string;
  make: string;
  model: string;
  firstRegistration?: string | null;
  color?: string;
  engineDisplacement?: number;
  fuelType?: string;
  transmission?: Transmission;
  mileage: number;
  nextTuvDate?: string;
  notes?: string;
  customer?: { id: string; firstName?: string; lastName?: string; companyName?: string; };
  createdAt: string;
  updatedAt: string;
}

export const vehiclesApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; customerId?: string }) =>
    apiClient.get<PaginatedResponse<Vehicle>>('/vehicles', { params }),
  getById: (id: string) => apiClient.get<Vehicle>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => apiClient.post<Vehicle>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) => apiClient.patch<Vehicle>(`/vehicles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/vehicles/${id}`),
};
