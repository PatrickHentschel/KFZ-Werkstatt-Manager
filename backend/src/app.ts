import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

import authPlugin from './plugins/auth';
import authRoutes from './modules/auth/auth.routes';
import customersRoutes from './modules/customers/customers.routes';
import vehiclesRoutes from './modules/vehicles/vehicles.routes';
import ordersRoutes from './modules/orders/orders.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import partsRoutes from './modules/parts/parts.routes';
import staffRoutes from './modules/staff/staff.routes';
import reportsRoutes from './modules/reports/reports.routes';
import settingsRoutes from './modules/settings/settings.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import { db, type DB } from './db';
import { AppError } from './utils/errors';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });
  // LAN-friendly CORS: explicit FRONTEND_URL plus localhost / private RFC1918 ranges in dev
  const LAN_ORIGIN_RE =
    /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.local)(:\d+)?$/i;
  const explicitOrigin = process.env.FRONTEND_URL;
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server (no Origin header)
      if (!origin) return cb(null, true);
      if (explicitOrigin && origin === explicitOrigin) return cb(null, true);
      if (process.env.NODE_ENV !== 'production' && LAN_ORIGIN_RE.test(origin)) {
        return cb(null, true);
      }
      return cb(new AppError(403, 'Forbidden', `Origin ${origin} not allowed`), false);
    },
    credentials: true,
  });
  await fastify.register(fastifyCookie);
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    skipOnError: true,
  });

  // Decorate with db instance (proxy – routes to tenant-scoped DB per request)
  fastify.decorate('db', db as DB);

  // Register auth plugin
  await fastify.register(authPlugin);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(customersRoutes, { prefix: '/api/v1/customers' });
  await fastify.register(vehiclesRoutes, { prefix: '/api/v1/vehicles' });
  await fastify.register(ordersRoutes, { prefix: '/api/v1/orders' });
  await fastify.register(invoicesRoutes, { prefix: '/api/v1/invoices' });
  await fastify.register(appointmentsRoutes, { prefix: '/api/v1/appointments' });
  await fastify.register(partsRoutes, { prefix: '/api/v1/parts' });
  await fastify.register(staffRoutes, { prefix: '/api/v1/staff' });
  await fastify.register(reportsRoutes, { prefix: '/api/v1/reports' });
  await fastify.register(settingsRoutes, { prefix: '/api/v1/settings' });
  await fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.error,
        message: error.message,
      });
    }

    // Zod errors
    if (error.name === 'ZodError') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: JSON.parse(error.message),
      });
    }

    fastify.log.error({ err: error, stack: error.stack, reqId: request.id }, 'Unhandled error');
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
    });
  });

  return fastify;
}
