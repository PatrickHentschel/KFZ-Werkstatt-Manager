export interface Appointment {
  id: string;
  tenantId: string;
  customerId: string;
  vehicleId?: string;
  orderId?: string;
  staffId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  color?: string;
  status: AppointmentStatus;
  reminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface CreateAppointmentRequest {
  customerId: string;
  vehicleId?: string;
  orderId?: string;
  staffId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  color?: string;
}

export type UpdateAppointmentRequest = Partial<CreateAppointmentRequest>;
