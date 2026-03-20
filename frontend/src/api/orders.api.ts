import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export type OrderStatus = 'open' | 'in_progress' | 'waiting_parts' | 'done' | 'invoiced';

export interface OrderItem {
  id: string; orderId: string; type: 'labor' | 'part' | 'misc';
  description: string; quantity: number; unitPrice: number; taxRate: number; sortOrder: number;
  partId?: string;
}

export interface Order {
  id: string; tenantId: string; orderNumber: string;
  customerId: string; vehicleId: string; status: OrderStatus;
  description?: string; mileageIn?: number; mileageOut?: number;
  estimatedDone?: string; notes?: string;
  assignedStaffId?: string;
  items: OrderItem[];
  customer?: { id: string; firstName?: string; lastName?: string; companyName?: string; };
  vehicle?: { id: string; licensePlate: string; make: string; model: string; };
  createdAt: string; updatedAt: string;
}

export interface TimeEntryWithStaff {
  id: string;
  staffId: string;
  orderId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  isManual: boolean;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    hourlyRate?: number;
    color?: string;
  };
}

export const ordersApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) =>
    apiClient.get<PaginatedResponse<Order>>('/orders', { params }),
  getById: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  create: (data: {
    customerId: string;
    vehicleId: string;
    description?: string;
    mileageIn?: number;
    assignedStaffId?: string;
  }) => apiClient.post<Order>('/orders', data),
  update: (id: string, data: Partial<Order>) => apiClient.patch<Order>(`/orders/${id}`, data),
  updateStatus: (id: string, status: OrderStatus) => apiClient.patch<Order>(`/orders/${id}/status`, { status }),
  updateItems: (id: string, items: Omit<OrderItem, 'id' | 'orderId'>[]) =>
    apiClient.put<Order>(`/orders/${id}/items`, { items }),
  createInvoice: (id: string) => apiClient.post(`/orders/${id}/invoice`),
  getTimeEntries: (id: string) =>
    apiClient.get<TimeEntryWithStaff[]>(`/orders/${id}/time-entries`),
  addTimeEntry: (id: string, data: { staffId: string; description?: string; durationMinutes: number }) =>
    apiClient.post<TimeEntryWithStaff>(`/orders/${id}/time-entries`, data),
};
