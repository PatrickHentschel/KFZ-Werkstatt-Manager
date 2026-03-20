export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  licensePlate: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  engineDisplacement?: number;
  fuelType?: FuelType;
  mileage?: number;
  nextTuvDate?: string;
  nextPickerlDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'lpg' | 'cng' | 'other';

export interface CreateVehicleRequest {
  customerId: string;
  licensePlate: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  engineDisplacement?: number;
  fuelType?: FuelType;
  mileage?: number;
  nextTuvDate?: string;
  nextPickerlDate?: string;
  notes?: string;
}

export type UpdateVehicleRequest = Partial<Omit<CreateVehicleRequest, 'customerId'>>;
