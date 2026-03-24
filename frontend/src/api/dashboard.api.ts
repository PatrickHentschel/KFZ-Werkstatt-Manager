import { apiClient } from './client';

export interface DashboardStats {
  openOrders: number;
  ordersCompletedThisMonth: number;
  totalCustomers: number;
  overdueInvoices: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    customer?: { id: string; firstName?: string; lastName?: string; companyName?: string };
    vehicle?: { id: string; licensePlate: string; make: string; model: string };
  }[];
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    customer?: { id: string; firstName?: string; lastName?: string; companyName?: string };
  }[];
}

export const dashboardApi = {
  getStats: () => apiClient.get<DashboardStats>('/dashboard/stats'),
};
