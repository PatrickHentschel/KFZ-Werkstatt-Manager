---
phase: 01-backend-draft-api
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/src/db/schema/invoices.ts
  - backend/src/db/migrations/0010_messy_radioactive_man.sql
  - backend/src/db/migrations/meta/_journal.json
  - backend/src/modules/invoices/invoices.routes.ts
  - backend/src/modules/invoices/invoices.service.ts
  - backend/src/modules/reports/reports.routes.ts
  - backend/src/utils/pdf.ts
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 1 draft invoice changes: schema migration dropping NOT NULL from `customer_id` / `issue_date`, the new `createDraft()` / `updateDraft()` service methods, the two new draft routes, and the downstream TypeScript fixes in `pdf.ts` and `reports.routes.ts`.

The draft business logic itself (DRAFT- prefix, no counter consumption, silent item-filter semantics) is correctly implemented. However two critical issues were found: a race-condition / gap in the existing invoice-number generation sequence, and a route-ordering bug that makes `PATCH /draft/:id` unreachable. Both must be fixed before the phase can be considered shippable. Four warnings and four info items cover null-safety gaps, silent data loss, and a missing sort on the top-customers report.

---

## Critical Issues

### CR-01: Non-atomic invoice-number generation — race condition and counter gaps

**File:** `backend/src/modules/invoices/invoices.service.ts:69-85`

**Issue:** In `create()`, the tenant invoice counter is incremented with a standalone UPDATE (line 69) and the invoice row is inserted in a separate statement (line 76). There is no wrapping database transaction. Two failure scenarios:

1. **Race condition:** Under concurrent requests, two UPDATE calls may both increment the counter and return the same `invoiceCounter` value before either INSERT completes (PostgreSQL read-committed isolation does not prevent this — the UPDATE is serialised but the returned value may be stale relative to a concurrent update). Result: duplicate invoice numbers.
2. **Gap on failure:** If the INSERT fails after the UPDATE commits, the counter has been consumed and a gap appears in the number sequence permanently.

**Fix:**
```typescript
async create(tenantId: string, data: { ... }) {
  return db.transaction(async (tx) => {
    const [tenant] = await tx.update(tenants)
      .set({ invoiceCounter: sql`${tenants.invoiceCounter} + 1` })
      .where(eq(tenants.id, tenantId))
      .returning();

    const invoiceNumber = `${tenant.invoicePrefix}-${String(tenant.invoiceCounter).padStart(5, '0')}`;

    const [invoice] = await tx.insert(invoices).values({
      tenantId,
      invoiceNumber,
      type: data.type,
      customerId: data.customerId,
      orderId: data.orderId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      notes: data.notes,
    }).returning();

    if (data.items.length > 0) {
      await tx.insert(invoiceItems).values(
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

    return this.getById(tenantId, invoice.id);
  });
}
```

---

### CR-02: Route ordering bug — `PATCH /draft/:id` is shadowed by `PATCH /:id` and is unreachable

**File:** `backend/src/modules/invoices/invoices.routes.ts:84` and `backend/src/modules/invoices/invoices.routes.ts:106`

**Issue:** Fastify resolves parametric routes in declaration order. `PATCH /:id` is registered at line 84 and `PATCH /draft/:id` at line 106. When a request for `PATCH /invoices/draft/some-uuid` arrives, Fastify matches the earlier `/:id` handler and binds `id = "draft"`. `invoicesService.update()` is called, finds no invoice with id `"draft"`, and throws 404. The `updateDraft` endpoint is effectively dead code.

Note: `POST /draft` (line 95) is not affected — static segments win over the root path on POST.

**Fix:** Register the more-specific static-prefix route before the parametric one:
```typescript
// Move PATCH /draft/:id registration BEFORE PATCH /:id

fastify.patch('/draft/:id', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request) => {
  const { id } = request.params as { id: string };
  const body = draftInvoiceSchema.parse(request.body);
  return invoicesService.updateDraft(request.user.tenantId, id, body);
});

fastify.patch('/:id', {
  preHandler: [fastify.requireRole('owner', 'admin')],
}, async (request) => {
  const { id } = request.params as { id: string };
  const body = updateInvoiceSchema.parse(request.body);
  return invoicesService.update(request.user.tenantId, id, body);
});
```

---

## Warnings

### WR-01: `tenant!` non-null assertion used without prior null-guard in two PDF routes

**File:** `backend/src/modules/invoices/invoices.routes.ts:141` and `backend/src/modules/invoices/invoices.routes.ts:177`

**Issue:** `db.query.tenants.findFirst()` returns `undefined` when no row is found. Both the `POST /:id/send` handler (line 141) and the `GET /:id/pdf` handler (line 177) apply `tenant!` directly. If the tenant row is missing (deleted between auth and query), the runtime will throw `TypeError: Cannot read properties of undefined`, returning an unhandled 500 instead of a meaningful error.

**Fix:**
```typescript
const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
if (!tenant) {
  return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Tenant not found' });
}
const pdfBuffer = await generateInvoicePdf(invoice, tenant); // no ! needed
```

---

### WR-02: Draft items are silently dropped without client feedback when `description` is missing

**File:** `backend/src/modules/invoices/invoices.service.ts:224` and `backend/src/modules/invoices/invoices.service.ts:276`

**Issue:** In both `createDraft()` and `updateDraft()`, items that lack a non-empty `description` are silently filtered out. The client receives a 201/200 with fewer items than it submitted, with no indication of how many were dropped or why. A frontend bug that omits `description` will silently discard line items — a data-loss footgun that will be difficult to debug.

**Fix (option A — surface the count as a warning field):**
```typescript
const droppedCount = data.items.length - validItems.length;
const result = await this.getById(tenantId, invoice.id);
return droppedCount > 0
  ? { ...result, _warnings: [`${droppedCount} item(s) skipped: description is required`] }
  : result;
```

**Fix (option B — reject the request):**
```typescript
const invalidItems = data.items.filter(i => !i.description || i.description.trim().length === 0);
if (invalidItems.length > 0) {
  throw errors.badRequest(`${invalidItems.length} item(s) are missing a description`);
}
```

---

### WR-03: Revenue reports filter on nullable `issueDate` without an explicit IS NOT NULL guard

**File:** `backend/src/modules/reports/reports.routes.ts:15-19` (and lines 112-117, 149-155)

**Issue:** Since the Phase 1 migration made `invoices.issue_date` nullable, any paid invoice that somehow has a NULL `issueDate` will be silently excluded from revenue totals when date-range filters are applied. Drizzle's `gte`/`lte` predicates on a nullable column do not add an implicit `IS NOT NULL`. The reports will produce incorrect (understated) totals without any error.

**Fix:**
```typescript
import { isNotNull } from 'drizzle-orm';

const whereClause = and(
  eq(invoices.tenantId, tenantId),
  eq(invoices.status, 'paid'),
  isNotNull(invoices.issueDate),
  from ? gte(invoices.issueDate, from) : undefined,
  to ? lte(invoices.issueDate, to) : undefined,
);
```

---

### WR-04: `updateDraft` writes `customerId` FK directly without UUID-format validation in the service layer

**File:** `backend/src/modules/invoices/invoices.service.ts:263`

**Issue:** The route-layer Zod schema validates `customerId` as `z.string().uuid().optional()`, but the service method signature accepts `customerId?: string` with no internal validation. Any future caller that bypasses the route (e.g. a test helper, another service method, or a future internal call) can supply a non-UUID string. PostgreSQL will then throw `invalid input syntax for type uuid`, surfacing as an unhandled 500.

**Fix:**
```typescript
import { z } from 'zod';

// At the top of updateDraft, before the DB query:
if (data.customerId !== undefined) {
  if (!z.string().uuid().safeParse(data.customerId).success) {
    throw errors.badRequest('Invalid customerId: must be a valid UUID');
  }
}
```

---

## Info

### IN-01: `top-customers` report slices before sorting — result is not actually top-N by revenue

**File:** `backend/src/modules/reports/reports.routes.ts:137-139`

**Issue:** `Array.from(map.values()).map(...).slice(0, Number(limit))` slices in Map insertion order (the order invoices were fetched from the DB), not by descending revenue. The endpoint name implies top N customers by revenue.

**Fix:**
```typescript
const customers = Array.from(map.values())
  .sort((a, b) => b.totalNet - a.totalNet)
  .map(c => ({ ...c, totalNet: Math.round(c.totalNet * 100) / 100 }))
  .slice(0, Number(limit));
```

---

### IN-02: `limit` query parameter in `top-customers` has no bounds validation

**File:** `backend/src/modules/reports/reports.routes.ts:109`

**Issue:** `limit` is cast directly to `Number()` with no minimum or maximum. A caller sending `limit=0` returns nothing; `limit=999999` loads all paid invoices into memory and iterates every line item.

**Fix:**
```typescript
const parsedLimit = Math.min(Math.max(1, Number(limit) || 10), 100);
// then use parsedLimit instead of Number(limit) in slice()
```

---

### IN-03: `formatDate` in `pdf.ts` is timezone-sensitive and may render one day early on UTC+ servers

**File:** `backend/src/utils/pdf.ts:168`

**Issue:** `new Date('2025-04-30')` parses the ISO date string as midnight UTC. Calling `.toLocaleDateString('de-AT')` then renders it in the server's local timezone. On a server in UTC+2 (CEST), `2025-04-30T00:00:00Z` renders correctly; on a UTC server it is also fine. But on a server configured to a timezone behind UTC (hypothetically), the date could shift backward. More practically, the Austria locale (de-AT, UTC+1/+2) is never behind UTC, but this is fragile for a date-only field that should never involve time.

**Fix:**
```typescript
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}
```

---

### IN-04: `undefined!` non-null assertion used to satisfy PDFKit overload — misleading pattern

**File:** `backend/src/utils/pdf.ts:56`

**Issue:** `doc.text(customer.address, 350, undefined!, { width: 200 })` asserts non-null on an explicitly `undefined` value to satisfy PDFKit's TypeScript overload signature. This is semantically confusing to future readers and is not idiomatic TypeScript.

**Fix:** Use the single-argument positional overload with options only:
```typescript
doc.text(customer.address ?? '', { align: 'left', width: 200 });
// or cast the y parameter cleanly:
doc.text(customer.address ?? '', 350, doc.y, { width: 200 });
```

---

_Reviewed: 2026-04-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
