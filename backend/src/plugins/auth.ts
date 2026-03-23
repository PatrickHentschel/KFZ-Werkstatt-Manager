import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@werkstatt/shared';
import { errors } from '../utils/errors';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw errors.unauthorized('No token provided');
      }

      const token = authHeader.slice(7);
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
      request.user = payload;
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid token' });
      } else {
        reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication failed' });
      }
    }
  });

  fastify.decorate('requireRole', function (...roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
    };
  });
};

export default fp(authPlugin);
