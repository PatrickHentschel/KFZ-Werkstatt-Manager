import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { paymentsService } from './payments.service';
import { config, isStripeEnabled } from '../../config';

const confirmDemoSchema = z.object({
  invoiceId: z.string().uuid(),
  sessionId: z.string(),
});

const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Authenticated routes ───────────────────────────────────────────────────
  await fastify.register(async (authenticated) => {
    authenticated.addHook('preHandler', fastify.authenticate);

    // GET /config — returns payment mode and publishable key for frontend
    authenticated.get('/config', async () => {
      return paymentsService.getPaymentConfig();
    });

    // POST /checkout/:invoiceId — create a checkout session and return redirect URL
    authenticated.post<{ Params: { invoiceId: string } }>(
      '/checkout/:invoiceId',
      {
        preHandler: fastify.requireRole('owner', 'admin'),
      },
      async (request) => {
        const { invoiceId } = request.params;
        const { tenantId } = request.user;
        return paymentsService.createCheckoutSession(tenantId, invoiceId);
      },
    );

    // POST /confirm-demo — demo mode: mark invoice as paid after fake checkout
    authenticated.post(
      '/confirm-demo',
      {
        preHandler: fastify.requireRole('owner', 'admin'),
      },
      async (request) => {
        const body = confirmDemoSchema.parse(request.body);
        const { tenantId } = request.user;
        return paymentsService.confirmDemoPayment(tenantId, body.invoiceId, body.sessionId);
      },
    );

    // GET /success — verify payment was recorded (used on the success redirect page)
    authenticated.get<{ Querystring: { session_id: string } }>(
      '/success',
      async (request) => {
        const sessionId = request.query.session_id;
        const { tenantId } = request.user;
        return paymentsService.getBySessionId(tenantId, sessionId);
      },
    );
  });

  // ── Stripe webhook (no auth, raw body required) ────────────────────────────
  fastify.register(async (webhookScope) => {
    webhookScope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );

    webhookScope.post('/webhook', async (request, reply) => {
      if (!isStripeEnabled()) {
        return reply.code(404).send({ error: 'Webhook not available in demo mode' });
      }

      const sig = request.headers['stripe-signature'] as string;
      if (!sig || !config.stripeWebhookSecret) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      const { StripePaymentProvider } = await import('./payments.stripe');
      const provider = new StripePaymentProvider(config.stripeSecretKey!);

      let event: import('stripe').default.Event;
      try {
        event = provider.constructWebhookEvent(
          request.body as Buffer,
          sig,
          config.stripeWebhookSecret,
        );
      } catch {
        return reply.code(400).send({ error: 'Webhook signature verification failed' });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as import('stripe').default.Checkout.Session;
        if (session.payment_status === 'paid') {
          await paymentsService.confirmStripePayment(session.id);
        }
      }

      return { received: true };
    });
  });
};

export default paymentsRoutes;
