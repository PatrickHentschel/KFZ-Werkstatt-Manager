import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { googleCalendarService } from './google-calendar.service';
import crypto from 'crypto';

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(), // ISO 8601 datetime
  endTime: z.string(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  colorId: z.string().optional(), // Google Calendar color IDs: 1-11
});

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  // Return Google OAuth URL as JSON — frontend fetches this with auth header, then redirects the browser
  fastify.get('/auth/google/url', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const tenantId = request.user.tenantId;
    const state = Buffer.from(JSON.stringify({
      tenantId,
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64url');
    const url = await googleCalendarService.getAuthUrl(tenantId, state);
    return { url };
  });

  // Google OAuth callback
  fastify.get('/auth/google/callback', async (request, reply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };

    if (error) {
      return reply.redirect(`${process.env.FRONTEND_URL}/appointments?error=google_auth_denied`);
    }

    if (!code || !state) {
      return reply.code(400).send({ message: 'Missing code or state' });
    }

    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      const { tenantId } = decoded;

      await googleCalendarService.handleCallback(tenantId, code);

      return reply.redirect(`${process.env.FRONTEND_URL}/appointments?connected=true`);
    } catch (err) {
      fastify.log.error(err);
      return reply.redirect(`${process.env.FRONTEND_URL}/appointments?error=google_auth_failed`);
    }
  });

  // Check connection status
  fastify.get('/status', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const tenantId = request.user.tenantId;
    const [connected, credentialsConfigured] = await Promise.all([
      googleCalendarService.isConnected(tenantId),
      googleCalendarService.credentialsConfigured(tenantId),
    ]);
    return { connected, credentialsConfigured };
  });

  // List available Google Calendars (to let user pick which one to use)
  fastify.get('/calendars', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    return googleCalendarService.listCalendars(request.user.tenantId);
  });

  // Set which calendar to use
  fastify.post('/calendars/select', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { calendarId } = z.object({ calendarId: z.string() }).parse(request.body);
    await googleCalendarService.setCalendar(request.user.tenantId, calendarId);
    return { success: true };
  });

  // Disconnect Google Calendar
  fastify.delete('/auth/google', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    await googleCalendarService.disconnect(request.user.tenantId);
    return reply.send({ success: true });
  });

  // List events
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { timeMin, timeMax, q } = request.query as { timeMin?: string; timeMax?: string; q?: string };
    return googleCalendarService.listEvents(request.user.tenantId, { timeMin, timeMax, q });
  });

  // Get single event
  fastify.get('/:eventId', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    return googleCalendarService.getEvent(request.user.tenantId, eventId);
  });

  // Create event
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const body = createEventSchema.parse(request.body);
    const event = await googleCalendarService.createEvent(request.user.tenantId, body);
    return reply.code(201).send(event);
  });

  // Update event
  fastify.patch('/:eventId', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    const body = createEventSchema.partial().parse(request.body);
    return googleCalendarService.updateEvent(request.user.tenantId, eventId, body);
  });

  // Delete event
  fastify.delete('/:eventId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    await googleCalendarService.deleteEvent(request.user.tenantId, eventId);
    return reply.code(204).send();
  });
};

export default appointmentsRoutes;
