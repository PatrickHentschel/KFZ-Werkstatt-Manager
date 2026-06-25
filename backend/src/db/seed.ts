// @ts-nocheck — seed file, runs via tsx without type checking; decimal columns require string in Drizzle insert types
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

  // Wipe existing seed data — tenants cascade-deletes everything
  await pool.query('DELETE FROM tenants');
  console.log('Cleared existing data.');

  // ── Tenant ──────────────────────────────────────────────────────────────
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
    isSmallBusiness: false,
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    bankName: 'Commerzbank',
    invoicePrefix: 'RE',
    invoiceCounter: 5,
    cancelInvoicePrefix: 'ST',
    cancelInvoiceCounter: 1,
    awMinutes: 5,
    plan: 'professional',
  }).returning();
  console.log(`Tenant: ${tenant.id}`);

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const [owner] = await db.insert(schema.users).values({
    tenantId: tenant.id,
    email: 'owner@demo-werkstatt.de',
    passwordHash,
    name: 'Hans Meister',
    role: 'owner',
  }).returning();

  await db.insert(schema.users).values({
    tenantId: tenant.id,
    email: 'admin@demo-werkstatt.de',
    passwordHash,
    name: 'Sara Admin',
    role: 'admin',
  });

  await db.insert(schema.users).values({
    tenantId: tenant.id,
    email: 'tech@demo-werkstatt.de',
    passwordHash,
    name: 'Klaus Fischer',
    role: 'technician',
  });
  console.log(`Users created (owner, admin, technician)`);

  // ── Staff ────────────────────────────────────────────────────────────────
  const [staffKlaus] = await db.insert(schema.staff).values({
    tenantId: tenant.id,
    firstName: 'Klaus',
    lastName: 'Fischer',
    email: 'k.fischer@demo-werkstatt.de',
    phone: '+49 30 1234568',
    role: 'Kfz-Meister',
    hourlyRate: 85,
    awRate: 95,
    costRate: 60,
    color: '#3B82F6',
    isActive: true,
  }).returning();

  const [staffAnna] = await db.insert(schema.staff).values({
    tenantId: tenant.id,
    firstName: 'Anna',
    lastName: 'Bauer',
    email: 'a.bauer@demo-werkstatt.de',
    phone: '+49 30 1234569',
    role: 'Serviceberaterin',
    hourlyRate: 70,
    awRate: 80,
    costRate: 50,
    color: '#10B981',
    isActive: true,
  }).returning();

  await db.insert(schema.staff).values({
    tenantId: tenant.id,
    firstName: 'Markus',
    lastName: 'Klein',
    email: 'm.klein@demo-werkstatt.de',
    role: 'Kfz-Techniker',
    hourlyRate: 72,
    awRate: 82,
    costRate: 52,
    color: '#F59E0B',
    isActive: true,
  });
  console.log(`Staff: 3 members`);

  // ── Customers ────────────────────────────────────────────────────────────
  const [cMueller] = await db.insert(schema.customers).values({
    tenantId: tenant.id,
    type: 'private',
    salutation: 'herr',
    firstName: 'Hans',
    lastName: 'Müller',
    birthDate: '1975-03-14',
    email: 'hans.mueller@example.de',
    phone: '+49 30 9876543',
    mobile: '+49 172 9876543',
    street: 'Hauptstraße',
    houseNumber: '42',
    city: 'Berlin',
    postalCode: '10117',
    country: 'DE',
    notes: 'Stammkunde seit 2019. Bevorzugt Terminerinnerung per SMS.',
  }).returning();

  const [cSchmidt] = await db.insert(schema.customers).values({
    tenantId: tenant.id,
    type: 'private',
    salutation: 'frau',
    firstName: 'Maria',
    lastName: 'Schmidt',
    email: 'maria.schmidt@example.de',
    phone: '+49 30 1122334',
    street: 'Gartenweg',
    houseNumber: '7',
    city: 'Berlin',
    postalCode: '10243',
    country: 'DE',
  }).returning();

  const [cWeber] = await db.insert(schema.customers).values({
    tenantId: tenant.id,
    type: 'private',
    salutation: 'herr',
    firstName: 'Thomas',
    lastName: 'Weber',
    email: 'tweber@example.de',
    mobile: '+49 176 5544332',
    city: 'Berlin',
    postalCode: '12555',
    country: 'DE',
  }).returning();

  const [cTransporte] = await db.insert(schema.customers).values({
    tenantId: tenant.id,
    type: 'business',
    companyName: 'Schmidt Transporte GmbH',
    email: 'fuhrpark@schmidt-transporte.de',
    phone: '+49 30 4455667',
    street: 'Industriestraße',
    houseNumber: '18',
    city: 'Berlin',
    postalCode: '12347',
    country: 'DE',
    taxId: 'DE987654321',
    notes: 'Flottenvertrag: 3 Fahrzeuge. Rechnungen per E-Mail an buchhaltung@schmidt-transporte.de',
  }).returning();

  const [cBaeckerei] = await db.insert(schema.customers).values({
    tenantId: tenant.id,
    type: 'business',
    companyName: 'Bäckerei Hoffmann',
    firstName: 'Georg',
    lastName: 'Hoffmann',
    email: 'g.hoffmann@baeckerei-hoffmann.de',
    phone: '+49 30 8877665',
    street: 'Bäckerweg',
    houseNumber: '3',
    city: 'Berlin',
    postalCode: '13355',
    country: 'DE',
  }).returning();
  console.log(`Customers: 5`);

  // ── Vehicles ─────────────────────────────────────────────────────────────
  const [vGolf] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cMueller.id,
    licensePlate: 'B-MM 1234',
    vin: 'WVWZZZ1KZAM123456',
    hsn: '0603',
    tsn: 'BBB',
    make: 'Volkswagen',
    model: 'Golf VII',
    firstRegistration: '2018-04-01',
    color: 'Silber',
    engineDisplacement: 1395,
    fuelType: 'benzin',
    transmission: 'manual',
    mileage: 87450,
    nextTuvDate: '2026-10-01',
  }).returning();

  const [vBmw] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cMueller.id,
    licensePlate: 'B-MM 5678',
    vin: 'WBA8E9C50HG123789',
    make: 'BMW',
    model: '320d',
    firstRegistration: '2021-07-15',
    color: 'Schwarz',
    engineDisplacement: 1995,
    fuelType: 'diesel',
    transmission: 'automatic',
    mileage: 42100,
    nextTuvDate: '2027-07-01',
  }).returning();

  const [vMercedes] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cSchmidt.id,
    licensePlate: 'B-MS 9901',
    make: 'Mercedes-Benz',
    model: 'C 200',
    firstRegistration: '2019-11-20',
    color: 'Weiß',
    engineDisplacement: 1991,
    fuelType: 'benzin',
    transmission: 'automatic',
    mileage: 61200,
    nextTuvDate: '2025-11-01',
    notes: 'TÜV überfällig! Kundin informieren.',
  }).returning();

  const [vTransporter] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cTransporte.id,
    licensePlate: 'B-ST 0011',
    vin: 'WV2ZZZ7HZ8H012345',
    make: 'Volkswagen',
    model: 'Transporter T6',
    firstRegistration: '2017-03-01',
    color: 'Weiß',
    engineDisplacement: 1968,
    fuelType: 'diesel',
    transmission: 'manual',
    mileage: 143800,
    nextTuvDate: '2026-03-01',
    notes: 'Getriebeprobleme bekannt. Lager bestellt.',
  }).returning();

  const [vAstra] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cWeber.id,
    licensePlate: 'B-TW 4422',
    make: 'Opel',
    model: 'Astra K',
    firstRegistration: '2020-02-10',
    color: 'Dunkelblau',
    engineDisplacement: 1199,
    fuelType: 'benzin',
    transmission: 'manual',
    mileage: 53600,
    nextTuvDate: '2026-02-01',
  }).returning();

  const [vTransit] = await db.insert(schema.vehicles).values({
    tenantId: tenant.id,
    customerId: cBaeckerei.id,
    licensePlate: 'B-BH 7700',
    make: 'Ford',
    model: 'Transit Custom',
    firstRegistration: '2016-08-01',
    fuelType: 'diesel',
    transmission: 'manual',
    mileage: 198400,
    nextTuvDate: '2026-08-01',
  }).returning();
  console.log(`Vehicles: 6`);

  // ── Vendors & Parts ───────────────────────────────────────────────────────
  const [vendorBosch] = await db.insert(schema.vendors).values({
    tenantId: tenant.id,
    name: 'Bosch Automotive GmbH',
    email: 'bestellung@bosch-automotive.de',
    phone: '+49 711 8110',
    address: 'Robert-Bosch-Platz 1, 70839 Gerlingen',
    contactPerson: 'Friedrich Lang',
  }).returning();

  const [vendorWuerth] = await db.insert(schema.vendors).values({
    tenantId: tenant.id,
    name: 'Würth GmbH & Co. KG',
    email: 'kfz@wuerth.de',
    phone: '+49 7940 150',
    address: 'Reinhold-Würth-Straße 12-17, 74653 Künzelsau',
    contactPerson: 'Sabine Maier',
  }).returning();

  await db.insert(schema.parts).values([
    {
      tenantId: tenant.id,
      sku: 'OF-VW-001',
      oemNumber: '04E115561H',
      name: 'Ölfilter VW/Audi 1.4 TSI',
      category: 'Filter',
      stockQuantity: 15,
      minStock: 5,
      unit: 'Stk',
      purchasePrice: 4.80,
      salePrice: 11.90,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal A-12',
    },
    {
      tenantId: tenant.id,
      sku: 'LF-BMW-001',
      oemNumber: '13717811026',
      name: 'Luftfilter BMW 2.0d',
      category: 'Filter',
      stockQuantity: 8,
      minStock: 5,
      unit: 'Stk',
      purchasePrice: 9.20,
      salePrice: 22.50,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal A-14',
    },
    {
      tenantId: tenant.id,
      sku: 'BRS-VW-001',
      oemNumber: '5C0615301',
      name: 'Bremsscheibe vorne VW Golf VII',
      category: 'Bremsen',
      stockQuantity: 4,
      minStock: 8,
      unit: 'Stk',
      purchasePrice: 32.00,
      salePrice: 74.90,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal B-03',
      description: 'Nachbestellung läuft — Lieferzeit 3–5 Werktage.',
    },
    {
      tenantId: tenant.id,
      sku: 'BRB-VW-001',
      name: 'Bremsbelag-Satz vorne VW Golf VII',
      category: 'Bremsen',
      stockQuantity: 2,
      minStock: 4,
      unit: 'Satz',
      purchasePrice: 18.50,
      salePrice: 44.90,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal B-04',
    },
    {
      tenantId: tenant.id,
      sku: 'ZK-NGK-001',
      name: 'Zündkerzen-Set NGK (4 Stk)',
      category: 'Zündung',
      stockQuantity: 20,
      minStock: 5,
      unit: 'Set',
      purchasePrice: 12.40,
      salePrice: 29.90,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal A-22',
    },
    {
      tenantId: tenant.id,
      sku: 'OEL-5W40-001',
      name: 'Motoröl 5W-40 (1 Liter)',
      category: 'Öle & Fluide',
      stockQuantity: 48,
      minStock: 20,
      unit: 'L',
      purchasePrice: 5.20,
      salePrice: 13.90,
      taxRate: 19,
      vendorId: vendorWuerth.id,
      location: 'Lager Öle',
    },
    {
      tenantId: tenant.id,
      sku: 'KM-G13-001',
      name: 'Kühlmittel G13 (1 Liter)',
      category: 'Öle & Fluide',
      stockQuantity: 6,
      minStock: 10,
      unit: 'L',
      purchasePrice: 3.80,
      salePrice: 9.90,
      taxRate: 19,
      vendorId: vendorWuerth.id,
      location: 'Lager Öle',
    },
    {
      tenantId: tenant.id,
      sku: 'KR-GATES-001',
      name: 'Keilrippenriemen Gates K060748',
      category: 'Riemen',
      stockQuantity: 12,
      minStock: 3,
      unit: 'Stk',
      purchasePrice: 14.60,
      salePrice: 34.90,
      taxRate: 19,
      vendorId: vendorBosch.id,
      location: 'Regal C-07',
    },
  ]);
  console.log(`Vendors: 2, Parts: 8`);

  // ── Orders ───────────────────────────────────────────────────────────────
  const [orderOpen] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0012',
    customerId: cWeber.id,
    vehicleId: vAstra.id,
    status: 'open',
    description: 'Großer Kundendienst: Ölwechsel, Luftfilter, Zündkerzen prüfen',
    mileageIn: 53620,
    estimatedDone: new Date('2026-06-27T17:00:00'),
    assignedStaffId: staffKlaus.id,
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderOpen.id,
      type: 'labor',
      description: 'Großer Kundendienst inkl. Motorölwechsel',
      quantity: 1.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderOpen.id,
      type: 'part',
      description: 'Motoröl 5W-40 (5 Liter)',
      quantity: 5,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'L',
      sortOrder: 1,
    },
    {
      orderId: orderOpen.id,
      type: 'part',
      description: 'Ölfilter VW/Audi 1.4 TSI',
      quantity: 1,
      unitPrice: 11.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
  ]);

  const [orderInProgress] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0013',
    customerId: cMueller.id,
    vehicleId: vGolf.id,
    status: 'in_progress',
    description: 'Bremsen vorne erneuern (Scheiben + Beläge). Kunde hat Quietschgeräusche gemeldet.',
    mileageIn: 87450,
    assignedStaffId: staffKlaus.id,
    notes: 'Bremsscheiben nachbestellt, kommen heute Nachmittag.',
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderInProgress.id,
      type: 'labor',
      description: 'Bremsscheiben und -beläge vorne wechseln',
      quantity: 2,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderInProgress.id,
      type: 'part',
      description: 'Bremsscheibe vorne (2x)',
      quantity: 2,
      unitPrice: 74.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 1,
    },
    {
      orderId: orderInProgress.id,
      type: 'part',
      description: 'Bremsbelag-Satz vorne',
      quantity: 1,
      unitPrice: 44.90,
      taxRate: 19,
      unit: 'Satz',
      sortOrder: 2,
    },
  ]);

  const [orderWaitingParts] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0010',
    customerId: cTransporte.id,
    vehicleId: vTransporter.id,
    status: 'waiting_parts',
    description: 'Getriebe: Lager defekt, Schaltung hakelt. Ersatzteil bestellt.',
    mileageIn: 143800,
    assignedStaffId: staffKlaus.id,
    notes: 'Getriebelager bestellt bei ZF. Lieferung voraussichtlich 27.06.2026.',
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderWaitingParts.id,
      type: 'labor',
      description: 'Getriebelager tauschen inkl. Diagnose',
      quantity: 5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderWaitingParts.id,
      type: 'part',
      description: 'Getriebelager VW T6 (Hauptlager)',
      quantity: 1,
      unitPrice: 189.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 1,
    },
  ]);

  const [orderDone] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0011',
    customerId: cSchmidt.id,
    vehicleId: vMercedes.id,
    status: 'done',
    description: 'Klimaanlage: Kältemittel auffüllen, Pollenfilter wechseln, Kondensator reinigen',
    mileageIn: 61180,
    mileageOut: 61200,
    assignedStaffId: staffAnna.id,
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderDone.id,
      type: 'labor',
      description: 'Klimaservice: Kältemittel R1234yf befüllen',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderDone.id,
      type: 'part',
      description: 'Kältemittel R1234yf (500g)',
      quantity: 1,
      unitPrice: 68.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 1,
    },
    {
      orderId: orderDone.id,
      type: 'part',
      description: 'Pollenfilter Mercedes C200',
      quantity: 1,
      unitPrice: 24.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      orderId: orderDone.id,
      type: 'misc',
      description: 'Klimaanlagenreiniger',
      quantity: 1,
      unitPrice: 15.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
  ]);

  const [orderInvoiced1] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0008',
    customerId: cBaeckerei.id,
    vehicleId: vTransit.id,
    status: 'invoiced',
    description: 'Hauptuntersuchung + Mängelbeseitigung: Bremsanlage hinten, Spurstangenkopf li.',
    mileageIn: 198100,
    mileageOut: 198400,
    assignedStaffId: staffKlaus.id,
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderInvoiced1.id,
      type: 'labor',
      description: 'Hauptuntersuchung (DEKRA)',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderInvoiced1.id,
      type: 'labor',
      description: 'Bremsanlage hinten: Scheiben + Beläge',
      quantity: 2.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 1,
    },
    {
      orderId: orderInvoiced1.id,
      type: 'labor',
      description: 'Spurstangenkopf links tauschen',
      quantity: 1.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 2,
    },
    {
      orderId: orderInvoiced1.id,
      type: 'part',
      description: 'Bremsscheibe hinten (2x)',
      quantity: 2,
      unitPrice: 69.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
    {
      orderId: orderInvoiced1.id,
      type: 'part',
      description: 'Bremsbelag-Satz hinten',
      quantity: 1,
      unitPrice: 38.90,
      taxRate: 19,
      unit: 'Satz',
      sortOrder: 4,
    },
    {
      orderId: orderInvoiced1.id,
      type: 'part',
      description: 'Spurstangenkopf links',
      quantity: 1,
      unitPrice: 54.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 5,
    },
  ]);

  const [orderInvoiced2] = await db.insert(schema.orders).values({
    tenantId: tenant.id,
    orderNumber: 'A-2026-0007',
    customerId: cMueller.id,
    vehicleId: vBmw.id,
    status: 'invoiced',
    description: 'BMW 320d: Ölwechsel + Luftfilter',
    mileageIn: 42050,
    mileageOut: 42100,
    assignedStaffId: staffKlaus.id,
    skontoPercent: 2,
    skontoDays: 14,
  }).returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: orderInvoiced2.id,
      type: 'labor',
      description: 'Motorölwechsel inkl. Ölfilter',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      orderId: orderInvoiced2.id,
      type: 'part',
      description: 'Motoröl 5W-40 (7 Liter)',
      quantity: 7,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'L',
      sortOrder: 1,
    },
    {
      orderId: orderInvoiced2.id,
      type: 'part',
      description: 'Ölfilter BMW 2.0d',
      quantity: 1,
      unitPrice: 14.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      orderId: orderInvoiced2.id,
      type: 'part',
      description: 'Luftfilter BMW 2.0d',
      quantity: 1,
      unitPrice: 22.50,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
  ]);
  console.log(`Orders: 6 (open, in_progress, waiting_parts, done, invoiced×2)`);

  // ── Invoices ─────────────────────────────────────────────────────────────
  // RE-00001: paid — Bäckerei Hoffmann (HU + Reparatur)
  const [inv1] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'RE-00001',
    type: 'invoice',
    status: 'paid',
    customerId: cBaeckerei.id,
    orderId: orderInvoiced1.id,
    issueDate: '2026-05-15',
    serviceDate: '2026-05-14',
    dueDate: '2026-06-14',
    paidAt: new Date('2026-05-28T10:30:00'),
    paymentMethod: 'bank_transfer',
    notes: 'Bezahlt per Überweisung.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: inv1.id,
      type: 'labor',
      description: 'Hauptuntersuchung (DEKRA)',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      invoiceId: inv1.id,
      type: 'labor',
      description: 'Bremsanlage hinten: Scheiben + Beläge',
      quantity: 2.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 1,
    },
    {
      invoiceId: inv1.id,
      type: 'labor',
      description: 'Spurstangenkopf links tauschen',
      quantity: 1.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 2,
    },
    {
      invoiceId: inv1.id,
      type: 'part',
      description: 'Bremsscheibe hinten (2x)',
      quantity: 2,
      unitPrice: 69.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
    {
      invoiceId: inv1.id,
      type: 'part',
      description: 'Bremsbelag-Satz hinten',
      quantity: 1,
      unitPrice: 38.90,
      taxRate: 19,
      unit: 'Satz',
      sortOrder: 4,
    },
    {
      invoiceId: inv1.id,
      type: 'part',
      description: 'Spurstangenkopf links',
      quantity: 1,
      unitPrice: 54.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 5,
    },
  ]);

  // RE-00002: paid — Müller/BMW (Ölwechsel, mit Skonto)
  const [inv2] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'RE-00002',
    type: 'invoice',
    status: 'paid',
    customerId: cMueller.id,
    orderId: orderInvoiced2.id,
    issueDate: '2026-05-20',
    serviceDate: '2026-05-19',
    dueDate: '2026-06-19',
    paidAt: new Date('2026-05-30T14:15:00'),
    paymentMethod: 'bank_transfer',
    skontoPercent: 2,
    skontoDays: 14,
    notes: '2% Skonto bei Zahlung innerhalb 14 Tagen.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: inv2.id,
      type: 'labor',
      description: 'Motorölwechsel inkl. Ölfilter',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      invoiceId: inv2.id,
      type: 'part',
      description: 'Motoröl 5W-40 (7 Liter)',
      quantity: 7,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'L',
      sortOrder: 1,
    },
    {
      invoiceId: inv2.id,
      type: 'part',
      description: 'Ölfilter BMW 2.0d',
      quantity: 1,
      unitPrice: 14.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      invoiceId: inv2.id,
      type: 'part',
      description: 'Luftfilter BMW 2.0d',
      quantity: 1,
      unitPrice: 22.50,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
  ]);

  // RE-00003: sent — Schmidt Transporte GmbH
  const [inv3] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'RE-00003',
    type: 'invoice',
    status: 'sent',
    customerId: cTransporte.id,
    issueDate: '2026-06-01',
    serviceDate: '2026-05-30',
    dueDate: '2026-07-01',
    notes: 'Zahlungsziel 30 Tage netto.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: inv3.id,
      type: 'labor',
      description: 'Wartung VW Transporter T6 (Inspektion)',
      quantity: 2,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      invoiceId: inv3.id,
      type: 'part',
      description: 'Motoröl 5W-40 (7 Liter)',
      quantity: 7,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'L',
      sortOrder: 1,
    },
    {
      invoiceId: inv3.id,
      type: 'part',
      description: 'Ölfilter VW Transporter',
      quantity: 1,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      invoiceId: inv3.id,
      type: 'misc',
      description: 'HU-Vorbereitung / Sichtprüfung',
      quantity: 1,
      unitPrice: 45.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
  ]);

  // RE-00004: draft — Maria Schmidt (Klimaservice)
  const [inv4] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'RE-00004',
    type: 'invoice',
    status: 'draft',
    customerId: cSchmidt.id,
    orderId: orderDone.id,
    issueDate: '2026-06-24',
    serviceDate: '2026-06-23',
    dueDate: '2026-07-24',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: inv4.id,
      type: 'labor',
      description: 'Klimaservice: Kältemittel R1234yf befüllen',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      invoiceId: inv4.id,
      type: 'part',
      description: 'Kältemittel R1234yf (500g)',
      quantity: 1,
      unitPrice: 68.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 1,
    },
    {
      invoiceId: inv4.id,
      type: 'part',
      description: 'Pollenfilter Mercedes C200',
      quantity: 1,
      unitPrice: 24.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      invoiceId: inv4.id,
      type: 'misc',
      description: 'Klimaanlagenreiniger',
      quantity: 1,
      unitPrice: 15.00,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
  ]);

  // RE-00005: cancelled — Weber (storniert)
  const [inv5] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'RE-00005',
    type: 'invoice',
    status: 'cancelled',
    customerId: cWeber.id,
    issueDate: '2026-06-10',
    serviceDate: '2026-06-10',
    dueDate: '2026-07-10',
    notes: 'Storniert — Kunde hat Rechnung RE-00005 beanstandet.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: inv5.id,
      type: 'labor',
      description: 'Inspektion Klein (Irrtum — falscher Auftrag)',
      quantity: 1,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
  ]);

  // ST-00001: credit_note — storniert RE-00005
  const [invCredit] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'ST-00001',
    type: 'credit_note',
    status: 'sent',
    customerId: cWeber.id,
    cancelsInvoiceId: inv5.id,
    issueDate: '2026-06-12',
    serviceDate: '2026-06-10',
    dueDate: '2026-06-12',
    notes: 'Gutschrift zu RE-00005.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: invCredit.id,
      type: 'labor',
      description: 'Gutschrift: Inspektion Klein (Storno RE-00005)',
      quantity: 1,
      unitPrice: -95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
  ]);

  // AN-00001: quote — Weber/Astra (Angebot Inspektion)
  const [invQuote] = await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    invoiceNumber: 'AN-00001',
    type: 'quote',
    status: 'draft',
    customerId: cWeber.id,
    issueDate: '2026-06-24',
    dueDate: '2026-07-24',
    notes: 'Angebot gültig 30 Tage.',
  }).returning();

  await db.insert(schema.invoiceItems).values([
    {
      invoiceId: invQuote.id,
      type: 'labor',
      description: 'Großer Kundendienst Opel Astra K 1.2',
      quantity: 1.5,
      unitPrice: 95,
      taxRate: 19,
      unit: 'AW',
      sortOrder: 0,
    },
    {
      invoiceId: invQuote.id,
      type: 'part',
      description: 'Motoröl 5W-40 (5 Liter)',
      quantity: 5,
      unitPrice: 13.90,
      taxRate: 19,
      unit: 'L',
      sortOrder: 1,
    },
    {
      invoiceId: invQuote.id,
      type: 'part',
      description: 'Ölfilter',
      quantity: 1,
      unitPrice: 11.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 2,
    },
    {
      invoiceId: invQuote.id,
      type: 'part',
      description: 'Luftfilter',
      quantity: 1,
      unitPrice: 18.90,
      taxRate: 19,
      unit: 'Stk',
      sortOrder: 3,
    },
    {
      invoiceId: invQuote.id,
      type: 'part',
      description: 'Zündkerzen-Set (4 Stk)',
      quantity: 1,
      unitPrice: 29.90,
      discountPercent: 10,
      taxRate: 19,
      unit: 'Set',
      sortOrder: 4,
    },
  ]);

  console.log(`Invoices: 5×invoice (paid×2, sent, draft, cancelled) + 1×credit_note + 1×quote`);

  console.log('\n✓ Seed complete!');
  console.log('Login: owner@demo-werkstatt.de / demo1234');
  console.log('Also: admin@demo-werkstatt.de / demo1234');
  console.log('Also: tech@demo-werkstatt.de / demo1234');

  await pool.end();
}

seed().catch(console.error);
