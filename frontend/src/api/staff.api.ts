import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export interface StaffMember {
  id: string; tenantId: string; userId?: string;
  firstName: string; lastName: string; email?: string; phone?: string;
  role: string; hourlyRate?: number; color?: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export const staffApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResponse<StaffMember>>('/staff', { params }),
  getById: (id: string) => apiClient.get<StaffMember>(`/staff/${id}`),
  create: (data: Partial<StaffMember>) => apiClient.post<StaffMember>('/staff', data),
  update: (id: string, data: Partial<StaffMember>) => apiClient.patch<StaffMember>(`/staff/${id}`, data),
};
