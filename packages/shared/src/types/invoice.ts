export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type InvoiceType = 'invoice' | 'quote' | 'credit_note';

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerId: string;
  orderId?: string;
  issueDate: string;
  dueDate?: string;
  paidAt?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  paymentMethod?: 'stripe' | 'demo' | 'manual';
  items: InvoiceItem[];
  totalNet: number;
  totalTax: number;
  totalGross: number;
  notes?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalNet: number;
  totalGross: number;
  sortOrder: number;
}

export interface CreateInvoiceRequest {
  type: InvoiceType;
  customerId: string;
  orderId?: string;
  issueDate: string;
  dueDate?: string;
  items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'totalNet' | 'totalGross'>[];
  notes?: string;
}

export type UpdateInvoiceRequest = Partial<Omit<CreateInvoiceRequest, 'customerId'>>;
