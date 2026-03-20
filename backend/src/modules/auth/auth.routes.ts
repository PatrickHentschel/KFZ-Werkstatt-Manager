import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  workshopName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().length(2).optional(),
});

const REFRESH_TOKEN_COOKIE = 'werkstatt_refresh';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerTenant(body);

    reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.code(201).send({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const result = await authService.login(email, password);

    reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  });

  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'No refresh token' });
    }

    const result = await authService.refresh(refreshToken);

    reply.setCookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  });

  fastify.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];
    await authService.logout(refreshToken || '');

    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
    return reply.send({ success: true });
  });

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = await fastify.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, request.user.sub),
      columns: { passwordHash: false },
    });
    if (!user) return reply.code(404).send({ message: 'User not found' });
    return reply.send(user);
  });
};

export default authRoutes;
