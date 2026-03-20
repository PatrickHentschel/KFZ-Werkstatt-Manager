import { apiClient } from './client';

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
  status?: string;
  htmlLink?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  colorId?: string;
}

export const appointmentsApi = {
  getStatus: () => apiClient.get<{ connected: boolean }>('/appointments/status'),
  getAuthUrl: () => apiClient.get<{ url: string }>('/appointments/auth/google/url'),
  disconnect: () => apiClient.delete('/appointments/auth/google'),
  listCalendars: () => apiClient.get<GoogleCalendar[]>('/appointments/calendars'),
  selectCalendar: (calendarId: string) => apiClient.post('/appointments/calendars/select', { calendarId }),
  listEvents: (params?: { timeMin?: string; timeMax?: string; q?: string }) =>
    apiClient.get<CalendarEvent[]>('/appointments', { params }),
  getEvent: (id: string) => apiClient.get<CalendarEvent>(`/appointments/${id}`),
  createEvent: (data: CreateEventRequest) => apiClient.post<CalendarEvent>('/appointments', data),
  updateEvent: (id: string, data: Partial<CreateEventRequest>) => apiClient.patch<CalendarEvent>(`/appointments/${id}`, data),
  deleteEvent: (id: string) => apiClient.delete(`/appointments/${id}`),
};
