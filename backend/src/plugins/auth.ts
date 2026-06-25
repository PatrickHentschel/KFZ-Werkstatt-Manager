import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { JwtPayload, UserRole } from '@werkstatt/shared';
import { config } from '../config';
import { db, pool, tenantDbStore, type DB } from '../db';
import { users } from '../db/schema';
import * as schema from '../db/schema';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
    // Internal: the dedicated pool client for this request.
    // Released in the onResponse hook registered below.
    _tenantPgClient?: PoolClient;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
    } catch {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid token' });
    }

    // Live-Check gegen DB: deaktivierte User dürfen sofort raus, nicht erst
    // nach Token-Expiry. Tenant-Mismatch (User in anderen Tenant verschoben)
    // wird ebenfalls hier geblockt. users-Tabelle ist RLS-exempt → raw db OK.
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, tenantId: true, role: true, isActive: true, email: true },
    });
    if (!dbUser || !dbUser.isActive || dbUser.tenantId !== payload.tenantId) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Account inactive or invalid' });
    }

    // Aktuelle Rolle aus DB ziehen — JWT könnte stale sein wenn Rolle downgraded wurde.
    request.user = {
      sub: dbUser.id,
      tenantId: dbUser.tenantId,
      role: dbUser.role as UserRole,
      email: dbUser.email,
    };

    // Check out a dedicated connection for this request and set the tenant
    // context GUC so Postgres RLS policies can enforce tenant isolation.
    // The connection is released in the onResponse hook below.
    let pgClient: PoolClient;
    try {
      pgClient = await pool.connect();
    } catch (err) {
      // DB pool exhausted or unavailable — propagate as 500
      throw err;
    }

    try {
      await pgClient.query(
        "SELECT set_config('app.current_tenant_id', $1, false)",
        [request.user.tenantId],
      );
    } catch (err) {
      pgClient.release();
      throw err;
    }

    const tenantDb: DB = drizzle(pgClient, { schema }) as DB;
    // enterWith sets the context for the current async execution chain,
    // which Fastify propagates through all subsequent hooks and the route
    // handler. The db proxy in db/index.ts will pick this up automatically.
    tenantDbStore.enterWith(tenantDb);
    request._tenantPgClient = pgClient;
  });

  fastify.decorate('requireRole', function (...roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
    };
  });

  // Release the dedicated per-request pool client after every response,
  // and clear the tenant GUC so the connection is clean when returned to
  // the pool.
  fastify.addHook('onResponse', async (request) => {
    const client = request._tenantPgClient;
    if (client) {
      await client.query("SELECT set_config('app.current_tenant_id', '', false)").catch(() => {});
      client.release();
    }
  });
};

export default fp(authPlugin);
