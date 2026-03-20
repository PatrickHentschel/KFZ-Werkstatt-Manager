export type OrderStatus = 'open' | 'in_progress' | 'waiting_parts' | 'done' | 'invoiced';
export type OrderItemType = 'labor' | 'part' | 'misc';

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string;
  vehicleId: string;
  status: OrderStatus;
  description?: string;
  mileageIn?: number;
  mileageOut?: number;
  estimatedDone?: string;
  assignedStaffId?: string;
  notes?: string;
  items: OrderItem[];
  totalNet: number;
  totalTax: number;
  totalGross: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  type: OrderItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalNet: number;
  totalGross: number;
  partId?: string;
  sortOrder: number;
}

export interface CreateOrderRequest {
  customerId: string;
  vehicleId: string;
  description?: string;
  mileageIn?: number;
  estimatedDone?: string;
  assignedStaffId?: string;
  notes?: string;
}

export interface CreateOrderItemRequest {
  type: OrderItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  partId?: string;
  sortOrder?: number;
}

export type UpdateOrderRequest = Partial<Omit<CreateOrderRequest, 'customerId' | 'vehicleId'>>;
