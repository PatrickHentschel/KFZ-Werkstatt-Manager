import { apiClient } from './client';
import type { PaginatedResponse } from './customers.api';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type InvoiceType = 'invoice' | 'quote' | 'credit_note';

export interface InvoiceItem {
  id: string; invoiceId: string; type: 'labor' | 'part' | 'misc'; description: string;
  quantity: number; unitPrice: number; unitCost: number; taxRate: number; unit?: string; sortOrder: number;
}

export interface Invoice {
  id: string; tenantId: string; invoiceNumber: string;
  type: InvoiceType; status: InvoiceStatus;
  customerId: string; orderId?: string;
  issueDate: string; dueDate?: string; paidAt?: string;
  items: InvoiceItem[]; notes?: string; pdfUrl?: string;
  customer?: { id: string; firstName?: string; lastName?: string; companyName?: string; };
  createdAt: string; updatedAt: string;
}

export interface DraftInvoicePayload {
  type?: 'invoice' | 'quote' | 'credit_note';
  customerId?: string;
  orderId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  items?: Array<{
    type?: 'labor' | 'part' | 'misc';
    description?: string;
    quantity?: number;
    unitPrice?: number;
    unitCost?: number;
    taxRate?: number;
    unit?: string;
    sortOrder?: number;
  }>;
}

export const invoicesApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; statuses?: string; search?: string }) =>
    apiClient.get<PaginatedResponse<Invoice>>('/invoices', { params }),
  getById: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),
  create: (data: Partial<Invoice> & { items: Omit<InvoiceItem, 'id' | 'invoiceId'>[] }) =>
    apiClient.post<Invoice>('/invoices', data),
  update: (id: string, data: { type?: InvoiceType; issueDate?: string; dueDate?: string; notes?: string; orderId?: string; items?: Omit<InvoiceItem, 'id' | 'invoiceId'>[] }) =>
    apiClient.patch<Invoice>(`/invoices/${id}`, data),
  updateStatus: (id: string, status: InvoiceStatus) =>
    apiClient.patch<Invoice>(`/invoices/${id}/status`, { status }),
  getPdf: (id: string) => apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  send: (id: string) => apiClient.post(`/invoices/${id}/send`),
  createDraft: (data: DraftInvoicePayload) => apiClient.post<Invoice>('/invoices/draft', data),
  updateDraft: (id: string, data: DraftInvoicePayload) => apiClient.patch<Invoice>(`/invoices/draft/${id}`, data),
  deleteDraft: (id: string) => apiClient.delete(`/invoices/draft/${id}`),
};
