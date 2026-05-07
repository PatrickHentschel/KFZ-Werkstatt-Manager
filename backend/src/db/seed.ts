import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import path from 'path';
import * as schema from './schema';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool, { schema });

  console.log('Seeding database...');

  // Create demo tenant
  const [tenant] = await db.insert(schema.tenants).values({
    name: 'Demo Werkstatt GmbH',
    email: 'info@demo-werkstatt.de',
    phone: '+49 30 1234567',
    address: 'Werkstattstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'DE',
    taxId: 'DE123456789',
    taxRate: 19,
    invoicePrefix: 'RE',
    invoiceCounter: 0,
    plan: 'trial',
  }).returning();

  console.log(`Created tenant: ${tenant.id}`);

  // Create owner user
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const [user] = await db.insert(schema.users).values({
    tenantId: tenant.id,
    email: 'owner@demo-werkstatt.de',
    passwordHash,
    name: 'Hans Meister',
    role: 'owner',
  }).returning();

  console.log(`Created user: ${user.email}`);
  console.log('\nSeed complete!');
  console.log('Login with: owner@demo-werkstatt.de / demo1234');

  await pool.end();
}

seed().catch(console.error);
