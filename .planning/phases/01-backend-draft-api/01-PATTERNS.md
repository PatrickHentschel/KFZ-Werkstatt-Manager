# Phase 1: Backend Draft API - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 2 (1 modified routes file, 1 modified service file)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/src/modules/invoices/invoices.routes.ts` | route | request-response | self (existing routes in same file) | exact |
| `backend/src/modules/invoices/invoices.service.ts` | service | CRUD | self (existing methods in same file) | exact |

Both targets are extensions of existing files — the analogs are the current contents of the same files.

---

## Pattern Assignments

### `backend/src/modules/invoices/invoices.routes.ts` — add draft routes

**Analog:** existing routes in `backend/src/modules/invoices/invoices.routes.ts`

**Imports pattern** (lines 1-9):
```typescript
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { invoicesService } from './invoices.service';
import { db } from '../../db';
import { tenants } from '../../db/schema/tenants';
import { customers } from '../../db/schema/customers';
import { generateInvoicePdf } from '../../utils/pdf';
import { sendEmail } from '../../utils/email';
```
No new imports are needed for the draft routes. `invoicesService` and `z` are already imported.

**Zod schema pattern — reuse `invoiceItemSchema`, define new `createDraftSchema`** (lines 11-38):
```typescript
// Existing schema to reuse for items validation:
const invoiceItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  unit: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
});

// New schema for POST /draft — all fields optional per D-04:
const createDraftSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

// New schema for PATCH /draft/:id — all fields optional per D-03:
const updateDraftSchema = createDraftSchema; // identical shape
```

**Auth + plugin-level preHandler pattern** (lines 40-41):
```typescript
const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);
  // plugin-level authenticate covers all routes; role is per-route below
```

**Role enforcement pattern — per-route preHandler** (lines 52-58):
```typescript
// Pattern from existing POST / route:
fastify.post('/', {
  preHandler: [fastify.requireRole('owner', 'admin')],
}, async (request, reply) => { ... });

// Draft routes must use three roles per D-07:
fastify.post('/draft', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request, reply) => { ... });

fastify.patch('/draft/:id', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request) => { ... });
```

**Core route handler pattern — POST with 201** (lines 52-58):
```typescript
fastify.post('/', {
  preHandler: [fastify.requireRole('owner', 'admin')],
}, async (request, reply) => {
  const body = createInvoiceSchema.parse(request.body);
  const invoice = await invoicesService.create(request.user.tenantId, body);
  return reply.code(201).send(invoice);
});
```
Draft POST copies this exactly: parse body, call service with `tenantId`, return 201 with full invoice object.

**Core route handler pattern — PATCH with param** (lines 60-66):
```typescript
fastify.patch('/:id', {
  preHandler: [fastify.requireRole('owner', 'admin')],
}, async (request) => {
  const { id } = request.params as { id: string };
  const body = updateInvoiceSchema.parse(request.body);
  return invoicesService.update(request.user.tenantId, id, body);
});
```
Draft PATCH copies this exactly: cast params, parse body, call service, return result (implicit 200).

---

### `backend/src/modules/invoices/invoices.service.ts` — add `createDraft()` and `updateDraft()`

**Analog:** existing `create()` and `update()` methods in `backend/src/modules/invoices/invoices.service.ts`

**Imports pattern** (lines 1-5):
```typescript
import { eq, and, sql, or, ilike, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { invoices, invoiceItems, tenants, orders, customers, parts } from '../../db/schema';
import { errors } from '../../utils/errors';
import { getPaginationParams, buildPaginatedResponse } from '../../utils/pagination';
```
No new imports needed. `invoices`, `invoiceItems`, `errors` are all already imported. UUID generation uses `crypto.randomUUID()` from Node's built-in `crypto` — no import required on Node 24.

**Draft number generation pattern** (new — no codebase analog, use Node built-in):
```typescript
// Per D-06: 'DRAFT-' + first 8 chars of a random UUID segment
const invoiceNumber = `DRAFT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
```

**`create()` method pattern — counter increment + insert + items insert** (lines 58-103):
```typescript
async create(tenantId: string, data: { ... }) {
  // 1. Increment tenant counter (DO NOT copy this for createDraft)
  const [tenant] = await db.update(tenants)
    .set({ invoiceCounter: sql`${tenants.invoiceCounter} + 1` })
    .where(eq(tenants.id, tenantId))
    .returning();
  const invoiceNumber = `${tenant.invoicePrefix}-${String(tenant.invoiceCounter).padStart(5, '0')}`;

  // 2. Insert invoice row
  const [invoice] = await db.insert(invoices).values({
    tenantId,
    invoiceNumber,
    type: data.type,
    customerId: data.customerId,
    // ...
  }).returning();

  // 3. Insert items if present
  if (data.items.length > 0) {
    await db.insert(invoiceItems).values(
      data.items.map((item, idx) => ({
        invoiceId: invoice.id,
        type: item.type ?? 'misc',
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        unitCost: String(item.unitCost ?? 0),
        taxRate: String(item.taxRate),
        unit: item.unit || null,
        sortOrder: item.sortOrder ?? idx,
      }))
    );
  }

  // 4. Return fully hydrated record
  return this.getById(tenantId, invoice.id);
}
```
`createDraft()` copies steps 2-4 only. Step 1 (counter increment) is SKIPPED — replaced by `crypto.randomUUID()` draft number. The `status` field defaults to `'draft'` from the schema, so no explicit `status` set is needed. All data fields (`customerId`, `issueDate`, etc.) must be made optional to match D-04; the `invoices` schema requires `customerId` and `issueDate` as NOT NULL — see note in Shared Patterns below.

**`update()` method pattern — find + guard + partial merge + items replace** (lines 148-193):
```typescript
async update(tenantId: string, id: string, data: { ... }) {
  // 1. Fetch and guard existence
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
  });
  if (!invoice) throw errors.notFound('Invoice');
  if (invoice.status !== 'draft') throw errors.badRequest('Nur Entwürfe können bearbeitet werden');

  // 2. Partial merge — undefined fields keep existing value
  await db.update(invoices)
    .set({
      type: data.type ?? invoice.type,
      issueDate: data.issueDate ?? invoice.issueDate,
      dueDate: data.dueDate !== undefined ? data.dueDate : invoice.dueDate,
      notes: data.notes !== undefined ? data.notes : invoice.notes,
      orderId: data.orderId !== undefined ? data.orderId : invoice.orderId,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

  // 3. Replace items if provided
  if (data.items !== undefined) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (data.items.length > 0) {
      await db.insert(invoiceItems).values( /* same map as create */ );
    }
  }

  // 4. Return hydrated record
  return this.getById(tenantId, id);
}
```
`updateDraft()` copies this method wholesale. The existing `update()` already guards `status !== 'draft'`, so `updateDraft()` can reuse or call into the same DB logic. Key difference: `updateDraft()` must additionally guard that the target record is a draft (not just any invoice).

**`errors.notFound()` usage pattern** (lines 54, 159):
```typescript
if (!invoice) throw errors.notFound('Invoice');
```
Use this exact call in `updateDraft()` for the missing-ID 404 case.

**Singleton export pattern** (line 208):
```typescript
export const invoicesService = new InvoicesService();
```
No change — new methods are added to the existing `InvoicesService` class; singleton export stays unchanged.

---

## Shared Patterns

### Authentication (plugin-level)
**Source:** `backend/src/modules/invoices/invoices.routes.ts` line 41
**Apply to:** all routes in the file (already present, no change needed)
```typescript
fastify.addHook('preHandler', fastify.authenticate);
```

### Role Enforcement (per-route)
**Source:** `backend/src/plugins/auth.ts` line 72; usage in `backend/src/modules/orders/orders.routes.ts` line 40
**Apply to:** both new draft route handlers
```typescript
preHandler: [fastify.requireRole('owner', 'admin', 'reception')]
```
This is the exact three-role tuple from D-07. Existing invoice routes only use `('owner', 'admin')` — the draft routes differ by adding `'reception'`.

### Error Factory
**Source:** `backend/src/utils/errors.ts` lines 15-22
**Apply to:** `updateDraft()` service method
```typescript
export const errors = {
  notFound: (resource = 'Resource') => new AppError(404, 'Not Found', `${resource} not found`),
  badRequest: (msg: string) => new AppError(400, 'Bad Request', msg),
  // ...
};
```
Use `errors.notFound('Invoice')` for unknown draft ID. Use `errors.badRequest(...)` if caller tries to PATCH a non-draft record (status guard).

### tenantId Scoping
**Source:** `backend/src/modules/invoices/invoices.service.ts` lines 50-56 (getById pattern)
**Apply to:** all new service methods
```typescript
where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId))
```
Every DB query must include `eq(invoices.tenantId, tenantId)` alongside the record ID filter.

### Items Insert Map
**Source:** `backend/src/modules/invoices/invoices.service.ts` lines 88-99
**Apply to:** `createDraft()` and `updateDraft()` items insert blocks
```typescript
data.items.map((item, idx) => ({
  invoiceId: invoice.id,
  type: item.type ?? 'misc',
  description: item.description,
  quantity: String(item.quantity),
  unitPrice: String(item.unitPrice),
  unitCost: String(item.unitCost ?? 0),
  taxRate: String(item.taxRate),
  unit: item.unit || null,
  sortOrder: item.sortOrder ?? idx,
}))
```
Decimal columns are stored as strings — `String(number)` is the established pattern, not `.toString()` or template literals.

---

## Schema Constraint Note

**Source:** `backend/src/db/schema/invoices.ts` lines 15-17

`customerId` and `issueDate` are `NOT NULL` at the DB level:
```typescript
customerId: uuid('customer_id').notNull().references(() => customers.id),
issueDate: date('issue_date').notNull(),
```

`createDraft()` must supply default values for these columns when the caller omits them (D-04 — no fields required). Recommended defaults:
- `customerId`: cannot be omitted without a schema change. Planner must decide: either require `customerId` in `createDraft()` or use a sentinel approach. This is the one schema constraint that conflicts with D-04.
- `issueDate`: default to `new Date().toISOString().split('T')[0]` (today's date), same pattern as `createFromOrder()` line 125.

---

## No Analog Found

None — all new code is an extension of existing patterns within the same files.

---

## Metadata

**Analog search scope:** `backend/src/modules/invoices/`, `backend/src/utils/`, `backend/src/plugins/`, `backend/src/db/schema/`
**Files scanned:** 6 (invoices.routes.ts, invoices.service.ts, invoices.ts schema, errors.ts, auth.ts plugin, orders.routes.ts for requireRole reference)
**Pattern extraction date:** 2026-04-17
