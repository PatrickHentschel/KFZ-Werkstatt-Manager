export interface Staff {
  id: string;
  tenantId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  hourlyRate?: number;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  tenantId: string;
  staffId: string;
  orderId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  isManual: boolean;
  createdAt: string;
}

export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  hourlyRate?: number;
  color?: string;
}
