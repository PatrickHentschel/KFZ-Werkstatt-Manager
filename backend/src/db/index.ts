import { AsyncLocalStorage } from 'async_hooks';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export type DB = NodePgDatabase<typeof schema>;

// The raw global DB instance backed by the connection pool.
// Used as a fallback when no per-request tenant context is active
// (e.g. background jobs, migrations, health checks).
const _rawDb: DB = drizzle(pool, { schema });

// Holds the per-request tenant-scoped Drizzle instance.
// Populated by the authenticate preHandler for every authenticated route.
export const tenantDbStore = new AsyncLocalStorage<DB>();

// Smart proxy: transparently delegates to the tenant-scoped DB when inside
// an authenticated request, or falls back to the raw pool-backed DB.
// This means all existing service code (import { db } from '../../db')
// automatically gets tenant isolation without any service-level changes.
export const db = new Proxy(_rawDb, {
  get(_target, prop: string | symbol) {
    const store = tenantDbStore.getStore();
    const target = store ?? _rawDb;
    const value = (target as any)[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as DB;
