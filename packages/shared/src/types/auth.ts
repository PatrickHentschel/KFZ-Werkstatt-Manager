export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterTenantRequest {
  workshopName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;       // user id
  tenantId: string;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

export type UserRole = 'owner' | 'admin' | 'technician' | 'reception';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}
