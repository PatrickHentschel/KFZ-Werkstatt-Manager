export interface Part {
  id: string;
  tenantId: string;
  sku: string;
  oemNumber?: string;
  name: string;
  description?: string;
  category?: string;
  stockQuantity: number;
  minStock: number;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  vendorId?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartRequest {
  sku: string;
  oemNumber?: string;
  name: string;
  description?: string;
  category?: string;
  stockQuantity?: number;
  minStock?: number;
  unit?: string;
  purchasePrice: number;
  salePrice: number;
  taxRate?: number;
  vendorId?: string;
  location?: string;
}

export type UpdatePartRequest = Partial<CreatePartRequest>;

export interface StockAdjustmentRequest {
  adjustment: number;
  reason?: string;
}
