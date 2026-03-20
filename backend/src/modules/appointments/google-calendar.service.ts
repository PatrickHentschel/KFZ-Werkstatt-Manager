import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { googleTokens } from '../../db/schema';
import { errors } from '../../utils/errors';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export class GoogleCalendarService {
  // Generate the OAuth2 URL the tenant must visit to authorize
  getAuthUrl(state: string): string {
    const oauth2Client = createOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    });
  }

  // Exchange code for tokens and store them
  async handleCallback(tenantId: string, code: string): Promise<void> {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) throw errors.badRequest('No access token received from Google');

    await db.insert(googleTokens).values({
      tenantId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenType: tokens.token_type ?? 'Bearer',
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      calendarId: 'primary',
    }).onConflictDoUpdate({
      target: googleTokens.tenantId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenType: tokens.token_type ?? 'Bearer',
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  // Get an authenticated calendar client for a tenant
  private async getCalendarClient(tenantId: string): Promise<{ calendar: calendar_v3.Calendar; calendarId: string }> {
    const tokenRecord = await db.query.googleTokens.findFirst({
      where: eq(googleTokens.tenantId, tenantId),
    });

    if (!tokenRecord) {
      throw errors.badRequest('Google Calendar not connected. Please authorize at /api/v1/appointments/auth/google');
    }

    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken ?? undefined,
      token_type: tokenRecord.tokenType ?? 'Bearer',
      expiry_date: tokenRecord.expiryDate?.getTime(),
    });

    // Auto-refresh tokens if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await db.update(googleTokens)
          .set({
            accessToken: tokens.access_token,
            expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(googleTokens.tenantId, tenantId));
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return { calendar, calendarId: tokenRecord.calendarId };
  }

  // Check if Google Calendar is connected for a tenant
  async isConnected(tenantId: string): Promise<boolean> {
    const token = await db.query.googleTokens.findFirst({
      where: eq(googleTokens.tenantId, tenantId),
    });
    return !!token;
  }

  // List events from Google Calendar
  async listEvents(tenantId: string, params: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    q?: string;
  }) {
    const { calendar, calendarId } = await this.getCalendarClient(tenantId);

    const response = await calendar.events.list({
      calendarId,
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: params.maxResults || 100,
      singleEvents: true,
      orderBy: 'startTime',
      q: params.q,
    });

    return response.data.items || [];
  }

  // Get a single event
  async getEvent(tenantId: string, eventId: string) {
    const { calendar, calendarId } = await this.getCalendarClient(tenantId);
    const response = await calendar.events.get({ calendarId, eventId });
    return response.data;
  }

  // Create an event
  async createEvent(tenantId: string, event: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    attendees?: string[];
    colorId?: string;
  }) {
    const { calendar, calendarId } = await this.getCalendarClient(tenantId);

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startTime,
          timeZone: 'Europe/Vienna',
        },
        end: {
          dateTime: event.endTime,
          timeZone: 'Europe/Vienna',
        },
        attendees: event.attendees?.map((email) => ({ email })),
        colorId: event.colorId,
      },
    });

    return response.data;
  }

  // Update an event
  async updateEvent(tenantId: string, eventId: string, event: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    colorId?: string;
  }) {
    const { calendar, calendarId } = await this.getCalendarClient(tenantId);

    // Get existing first to patch
    const existing = await calendar.events.get({ calendarId, eventId });
    const body = existing.data;

    if (event.title) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;
    if (event.colorId !== undefined) body.colorId = event.colorId;
    if (event.startTime) body.start = { dateTime: event.startTime, timeZone: 'Europe/Vienna' };
    if (event.endTime) body.end = { dateTime: event.endTime, timeZone: 'Europe/Vienna' };

    const response = await calendar.events.update({ calendarId, eventId, requestBody: body });
    return response.data;
  }

  // Delete an event
  async deleteEvent(tenantId: string, eventId: string) {
    const { calendar, calendarId } = await this.getCalendarClient(tenantId);
    await calendar.events.delete({ calendarId, eventId });
  }

  // List available calendars for the tenant's Google account
  async listCalendars(tenantId: string) {
    const { calendar } = await this.getCalendarClient(tenantId);
    const response = await calendar.calendarList.list();
    return response.data.items || [];
  }

  // Set which calendar to use
  async setCalendar(tenantId: string, calendarId: string) {
    await db.update(googleTokens)
      .set({ calendarId, updatedAt: new Date() })
      .where(eq(googleTokens.tenantId, tenantId));
  }

  // Disconnect (revoke and delete tokens)
  async disconnect(tenantId: string) {
    const tokenRecord = await db.query.googleTokens.findFirst({
      where: eq(googleTokens.tenantId, tenantId),
    });

    if (tokenRecord) {
      try {
        const oauth2Client = createOAuthClient();
        await oauth2Client.revokeToken(tokenRecord.accessToken);
      } catch {
        // Ignore revoke errors
      }
      await db.delete(googleTokens).where(eq(googleTokens.tenantId, tenantId));
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
