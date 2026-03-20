import { apiClient } from './client';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { workshopName: string; email: string; password: string; phone?: string; }
export interface AuthResponse { accessToken: string; expiresIn: number; user: { id: string; email: string; role: string; tenantId: string; }; }

export const authApi = {
  login: (data: LoginRequest) => apiClient.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post<AuthResponse>('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  refresh: () => apiClient.post<AuthResponse>('/auth/refresh'),
  me: () => apiClient.get('/auth/me'),
};
