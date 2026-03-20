import { apiClient } from './client';

export const reportsApi = {
  getRevenue: (params?: { from?: string; to?: string }) =>
    apiClient.get('/reports/revenue', { params }),
  getOrders: () => apiClient.get('/reports/orders'),
  getStaff: (params?: { from?: string; to?: string }) =>
    apiClient.get('/reports/staff', { params }),
  getParts: () => apiClient.get('/reports/parts'),
};
