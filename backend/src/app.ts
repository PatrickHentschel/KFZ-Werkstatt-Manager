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
import { db } from './db';
import { AppError } from './utils/errors';

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
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
  await fastify.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  await fastify.register(fastifyCookie);
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    skipOnError: true,
  });

  // Decorate with db instance
  fastify.decorate('db', db);

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
