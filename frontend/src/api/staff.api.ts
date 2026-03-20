import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export interface StaffMember {
  id: string; tenantId: string; userId?: string;
  firstName: string; lastName: string; email?: string; phone?: string;
  role: string; hourlyRate?: number; color?: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export interface TimeEntry {
  id: string; staffId: string; orderId?: string; description?: string;
  startTime: string; endTime?: string; durationMinutes?: number; isManual: boolean;
}

export const staffApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResponse<StaffMember>>('/staff', { params }),
  getById: (id: string) => apiClient.get<StaffMember>(`/staff/${id}`),
  create: (data: Partial<StaffMember>) => apiClient.post<StaffMember>('/staff', data),
  update: (id: string, data: Partial<StaffMember>) => apiClient.patch<StaffMember>(`/staff/${id}`, data),
  startTimer: (id: string, orderId?: string, description?: string) =>
    apiClient.post<TimeEntry>(`/staff/${id}/timer/start`, { orderId, description }),
  stopTimer: (id: string) => apiClient.post<TimeEntry>(`/staff/${id}/timer/stop`),
  listTimeEntries: (id: string) => apiClient.get<PaginatedResponse<TimeEntry>>(`/staff/${id}/time-entries`),
  deleteTimeEntry: (staffId: string, entryId: string) => apiClient.delete(`/staff/${staffId}/time-entries/${entryId}`),
};
