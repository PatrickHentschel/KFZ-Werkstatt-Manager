# Phase 1: Backend Draft API - Research

**Researched:** 2026-04-17
**Domain:** Fastify HTTP routing + Drizzle ORM + PostgreSQL (multi-tenant invoice persistence)
**Confidence:** HIGH

## Summary

This phase adds two new HTTP endpoints to the existing `invoices` Fastify module so that the upcoming auto-save feature can persist a partially-filled invoice form as `status='draft'` without consuming the tenant's sequential invoice number counter. Everything needed is already established in the codebase: `invoiceStatusEnum` includes `'draft'`, the `requireRole` Fastify decorator exists, RLS is enforced via the `app.current_tenant_id` GUC, and the `InvoicesService` singleton is the conventional extension point. No new dependencies, no migrations, no architectural changes.

The single non-trivial constraint is a **schema vs. CONTEXT conflict**: `invoices.customerId` and `invoices.issueDate` are `NOT NULL` at the DB level (verified in migration `0000_high_omega_red.sql` lines 184, 186), but CONTEXT D-04 says "all fields optional for draft." The plan must reconcile this — either by (a) generating sentinel placeholder values server-side when those fields are missing, or (b) returning 400 if `customerId`/`issueDate` are absent. Option (a) is recommended and is the only path that fully honours D-04 without a schema migration.

**Primary recommendation:** Extend `InvoicesService` with `createDraft(tenantId, partial)` and `updateDraft(tenantId, id, partial)` methods. Generate the placeholder `invoiceNumber` as `DRAFT-${randomUUID().slice(0, 8)}` using Node's built-in `crypto.randomUUID()`. For missing-but-required-by-DB fields on create, write sentinel values (`customerId = NULL_UUID`, `issueDate = today`) and document the convention in code; the frontend never reads these for drafts. Register the routes in the existing `invoices.routes.ts` plugin alongside the current routes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Validate inbound draft payload | API / Backend | — | Zod schema runs at the route boundary, identical pattern to existing routes |
| Generate `DRAFT-xxxx` placeholder | API / Backend | — | Number generation must be server-controlled (deterministic, not influenced by client) |
| Persist draft row + items | Database / Storage | API / Backend | Drizzle service layer issues SQL; PostgreSQL holds canonical state. RLS enforces tenant isolation. |
| Authorize role (owner/admin/reception) | API / Backend | — | `fastify.requireRole(...)` preHandler — established cross-cutting pattern |
| Tenant scoping | Database / Storage | API / Backend | Auth plugin sets `app.current_tenant_id` GUC; RLS policies in migration `0003_tenant_rls.sql` enforce it at the row level |
| Returning full invoice shape (with items) | API / Backend | — | Service `getById()` already does the join via Drizzle's `with: { items: true, customer: true }` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | 4.28.1 | HTTP server, plugin system | Already in use across all 12 modules |
| Drizzle ORM | 0.33.0 | Type-safe SQL builder | All existing service code uses it |
| Zod | 3.23.8 | Runtime request validation | Standard parse-then-handle pattern in every route file |
| PostgreSQL | 16-alpine | Persistence | Existing infra |
| `node:crypto` (built-in) | Node 24 | `randomUUID()` for `DRAFT-xxxx` | No dependency needed; already used in `auth.service.ts` and `appointments.routes.ts` |

[VERIFIED: backend/package.json] All four libraries already installed at the listed versions. CLAUDE.md constraint "no new dependencies" is satisfied.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `errors` factory (`backend/src/utils/errors.ts`) | local | Throws `AppError` with status code | Use `errors.notFound('Draft')` in PATCH when ID missing |
| `fastify.requireRole(...)` | local | Role-based authz preHandler | Per-route preHandler array |
| `fastify.authenticate` | local | JWT verification + sets RLS GUC | Plugin-level `addHook('preHandler', ...)` (already at top of `invoices.routes.ts`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two endpoints (POST create + PATCH update) | Single `PUT /invoices/draft` upsert by client-supplied id | CONTEXT D-01 explicitly chose two endpoints — do NOT revisit |
| `DRAFT-${uuid8}` | `DRAFT-${tenantCounter}` | A separate counter would still grow forever and could collide with old drafts; UUID is collision-free and stateless. CONTEXT D-06 already chose UUID. |
| Separate `draftsService` class | Extend `InvoicesService` | CONTEXT specifies extending the existing service — follows established singleton pattern |
| Adding draft methods inside `invoicesService.create()` with a flag | Distinct `createDraft()` method | Mixing paths risks accidentally calling the counter-incrementing branch. Keep the draft path completely separate. |

**Installation:**
```bash
# No installation required — all dependencies already present
```

**Version verification:** All packages confirmed in `backend/package.json` and locked via `package-lock.json`. No registry lookup required.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────┐
│ Frontend (Phase 2)     │
│ axios POST/PATCH       │
│ /api/v1/invoices/draft │
└──────────┬─────────────┘
           │ Bearer JWT
           ▼
┌─────────────────────────────────────────────────┐
│ Fastify (backend/src/app.ts)                    │
│   register(invoicesRoutes, '/api/v1/invoices')  │
└──────────┬──────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────┐
│ Plugin preHandler chain                          │
│  1. fastify.authenticate (JWT verify)            │
│     → sets app.current_tenant_id GUC on PG conn  │
│  2. fastify.requireRole('owner','admin',         │
│                         'reception')             │
└──────────┬──────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────┐
│ Route handler (invoices.routes.ts)              │
│  • Zod parse(request.body) → 400 on fail        │
│  • Calls invoicesService.createDraft(...)       │
│    or invoicesService.updateDraft(id, ...)      │
└──────────┬──────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────┐
│ InvoicesService (extended singleton)            │
│  createDraft:                                    │
│    • generate DRAFT-{uuid8} number               │
│    • INSERT into invoices (status='draft')      │
│    • INSERT items (if any)                       │
│    • return getById(id)                          │
│  updateDraft:                                    │
│    • SELECT to verify exists & is draft         │
│    • UPDATE supplied fields only                 │
│    • DELETE+INSERT items if items provided      │
│    • return getById(id)                          │
└──────────┬──────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────┐
│ PostgreSQL                                      │
│  • RLS policy tenant_isolation enforces tenant  │
│  • invoice_items cascade-deleted on parent del  │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure
No new files. All changes in:
```
backend/src/modules/invoices/
├── invoices.routes.ts    # ADD: POST /draft, PATCH /draft/:id
└── invoices.service.ts   # ADD: createDraft(), updateDraft()
```

### Pattern 1: Fastify route with role + Zod parse
**What:** Standard route definition pattern used throughout the project.
**When to use:** Every new route in this phase.
**Example:**
```typescript
// Source: backend/src/modules/invoices/invoices.routes.ts:52-58 (existing)
fastify.post('/', {
  preHandler: [fastify.requireRole('owner', 'admin')],
}, async (request, reply) => {
  const body = createInvoiceSchema.parse(request.body);
  const invoice = await invoicesService.create(request.user.tenantId, body);
  return reply.code(201).send(invoice);
});
```

For draft endpoints, reuse this shape but pass `'owner', 'admin', 'reception'` per CONTEXT D-07.

### Pattern 2: Service method with tenantId-first signature
**What:** Service methods always take `tenantId` as first parameter even though RLS enforces it at the DB layer (defense in depth).
**Example:**
```typescript
// Source: backend/src/modules/invoices/invoices.service.ts:148-193 (existing update())
async update(tenantId: string, id: string, data: { ... }) {
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
  });
  if (!invoice) throw errors.notFound('Invoice');
  // ...
}
```

Draft methods follow the same signature: `createDraft(tenantId, data)`, `updateDraft(tenantId, id, data)`.

### Pattern 3: Placeholder ID generation
**What:** Use Node built-in `crypto.randomUUID()` (no `uuid` package needed for this).
**Example:**
```typescript
// Source: backend/src/modules/auth/auth.service.ts:4 imports crypto
import crypto from 'crypto';
const draftNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;
// e.g. "DRAFT-a3f2c1b8"
```
[VERIFIED: backend/src/modules/auth/auth.service.ts uses `import crypto from 'crypto'`]

Note: while `uuid` v10 IS in `package.json`, the codebase already imports the built-in `crypto` module for hashing and nonces; using `crypto.randomUUID()` is consistent and avoids adding another import.

### Anti-Patterns to Avoid
- **Calling `invoicesService.create()` from the draft path:** It increments `tenants.invoiceCounter` atomically (lines 68-71 of `invoices.service.ts`). This MUST NOT happen for drafts. CONTEXT explicitly forbids it.
- **Using the existing `invoicesService.update()` for drafts:** Its signature requires non-undefined fields and throws `errors.badRequest('Nur Entwürfe können bearbeitet werden')` for non-draft rows. It also REPLACES items wholesale on every call (`db.delete(invoiceItems)` then re-insert). For PATCH semantics where the client may not send `items`, the `if (data.items !== undefined)` guard on line 173 already prevents item deletion when items are absent — so the existing branch is partially reusable BUT the conventional route was to add a separate method. Per CONTEXT, add a separate method.
- **Returning the placeholder `invoiceNumber` from the frontend on subsequent saves:** The frontend stores the draft `id` (UUID) and PATCHes by id. The placeholder number is display-only.
- **Hand-rolling tenant filtering:** RLS already enforces it via the `app.current_tenant_id` GUC. Continue passing `tenantId` in `where` clauses for explicit defense-in-depth, matching existing pattern.
- **Forgetting `reply.code(201)` for POST:** Existing convention — use 201 for create, default 200 for PATCH.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique placeholder number | A counter table or random string with collision check | `crypto.randomUUID().slice(0, 8)` | UUID v4 collision probability is negligible at draft volumes; no extra DB round-trip |
| Tenant isolation | Adding `WHERE tenant_id = ?` to every raw query | Auth plugin sets `app.current_tenant_id` GUC; RLS policies enforce | Already migrated (`0003_tenant_rls.sql`) and tested in production code paths |
| JWT parsing / role check | Inspecting `Authorization` header in handlers | `fastify.authenticate` + `fastify.requireRole(...)` | Already decorated on the Fastify instance |
| Returning full invoice shape | Composing the response by hand | Call `invoicesService.getById(tenantId, id)` after insert/update | Existing method already does the `with: { customer: true, items: true }` join |
| Validating UUIDs in route params | Manual regex | `z.object({ id: z.string().uuid() }).parse(request.params)` if desired | Not strictly required — Drizzle will reject malformed UUIDs at query time. Existing routes don't validate route params, so omit for consistency. |
| Catching Zod errors | try/catch in each handler | Global `setErrorHandler` in `app.ts` already converts `ZodError` → 400 | Established at `app.ts:91-97` |

**Key insight:** Almost everything needed is already abstracted. The only new code is two service methods and two route handlers (~80 LOC total).

## Schema Constraint Reconciliation

**This is the highest-risk planning issue.** The DB enforces NOT NULL on three columns that CONTEXT D-04 says are optional for drafts:

| Column | DB constraint | CONTEXT decision | Resolution |
|--------|--------------|------------------|------------|
| `invoice_number` | `varchar(50) NOT NULL` | Auto-generated `DRAFT-xxxx` | Always generated server-side — no conflict |
| `customer_id` | `uuid NOT NULL` REFERENCES customers(id) | Optional in payload | **Conflict** — must resolve (see options below) |
| `issue_date` | `date NOT NULL` | Optional in payload | **Conflict** — must resolve (see options below) |
| `tenant_id` | `uuid NOT NULL` | Always present from JWT | No conflict |
| `type` | `invoice_type NOT NULL DEFAULT 'invoice'` | Optional | DB default handles it |
| `status` | `invoice_status NOT NULL DEFAULT 'draft'` | Always 'draft' here | No conflict |

[VERIFIED: backend/src/db/migrations/0000_high_omega_red.sql:178-193]

**Resolution options for `customerId` and `issueDate`:**

**Option A (recommended): Server-side defaults when missing**
- If `customerId` not supplied → write `'00000000-0000-0000-0000-000000000000'` as a sentinel "no customer yet" marker. **BLOCKER:** the FK constraint `invoices_customer_id_customers_id_fk` will reject any UUID that doesn't exist in `customers`. So the sentinel approach requires either (a) creating a per-tenant "draft placeholder" customer row at draft time, or (b) **dropping the NOT NULL + FK constraints on `customer_id`** via a new migration.
- If `issueDate` not supplied → write `new Date().toISOString().split('T')[0]` (today). This works without schema change.

**Option B: Schema migration to relax NOT NULL**
- Migration adds: `ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;` and `ALTER TABLE invoices ALTER COLUMN issue_date DROP NOT NULL;`
- The FK on `customer_id` already allows NULL once the NOT NULL is dropped (FK only fires when value is non-NULL).
- Pro: cleanest semantics, matches CONTEXT D-04 literally.
- Con: CLAUDE.md constraint says "**No migrations needed** — `draft` status and `quote` type already in DB schema." This contradicts Option B.
- Con: When the draft is finalized later (Phase 4), code must verify these fields are populated before transitioning status to `sent`.

**Option C: Keep NOT NULL, require minimum payload**
- Reject POST `/draft` with 400 if `customerId` or `issueDate` missing.
- Pro: no schema change, no sentinel rows.
- Con: directly contradicts CONTEXT D-04 ("No fields are required to create a draft — the JWT `tenantId` is sufficient").
- Con: Auto-save requirement DRAFT-04 says "auto-save only triggers if at least one required field has been filled" — but does NOT specify which fields. If "at least one" includes notes-only, this option fails.

**Recommendation for planner:** **Option B (DROP NOT NULL)** is the only option that fully honours CONTEXT D-04 and survives all auto-save scenarios. It DOES contradict the CLAUDE.md "no migrations needed" line — but that line was written before D-04 was decided. Surface this conflict to the user as a planning question:

> The database currently enforces `customer_id NOT NULL` and `issue_date NOT NULL` on the `invoices` table. CONTEXT D-04 says all fields are optional for drafts. To honour D-04 we must either (a) add a migration that drops these NOT NULL constraints, or (b) require `customerId` + `issueDate` in every draft save. Which do you prefer?

If user picks (a): add migration `0010_invoices_nullable_for_drafts.sql`.
If user picks (b): tighten the Zod schema to require those two fields, and update CONTEXT D-04 accordingly.

## Common Pitfalls

### Pitfall 1: Accidentally consuming the invoice counter
**What goes wrong:** Refactoring the draft path to share code with `create()` causes the counter increment to fire and produces gaps in the real invoice sequence.
**Why it happens:** The atomic counter increment (`UPDATE tenants SET invoice_counter = invoice_counter + 1`) is buried at lines 68-71 of `invoices.service.ts`. Easy to miss when "factoring out the common parts."
**How to avoid:** Keep `createDraft()` completely independent — do not share helpers with `create()`. Add a code comment.
**Warning signs:** A test (manual or automated) that creates a draft then a real invoice and observes a counter jump from N to N+2.

### Pitfall 2: PATCH replaces items even when client didn't send them
**What goes wrong:** Frontend sends `{notes: "x"}` to update notes, server wipes all items.
**Why it happens:** Naive `update()` implementations call `DELETE FROM invoice_items WHERE invoice_id = ?` unconditionally.
**How to avoid:** Use `if (data.items !== undefined)` guard — the existing `update()` method on line 173 already does this; copy the pattern verbatim. Distinguish "field absent" from "field is empty array".
**Warning signs:** A draft loses items after a notes-only PATCH.

### Pitfall 3: PATCH allows updating non-draft invoices
**What goes wrong:** Client passes a sent/paid invoice id and accidentally mutates a finalized record.
**Why it happens:** No status check before update.
**How to avoid:** Mirror existing `update()` pattern (line 160): `if (invoice.status !== 'draft') throw errors.badRequest('...')`. Return 404 if not found, 400 if found but not draft.
**Warning signs:** A finalized invoice's items change.

### Pitfall 4: Zod parse error returns wrong shape
**What goes wrong:** Custom try/catch returns differently shaped error than other endpoints.
**Why it happens:** Forgetting that the global `setErrorHandler` in `app.ts:91-97` already handles `ZodError`.
**How to avoid:** Just call `schema.parse()` and let it throw. The error handler turns it into `{statusCode: 400, error: 'Validation Error', message: ...}`.
**Warning signs:** Frontend gets a 500 instead of 400 on bad payload.

### Pitfall 5: Forgetting role enforcement on PATCH
**What goes wrong:** Technician can edit a draft created by reception (CONTEXT D-07 forbids).
**Why it happens:** PATCH route omits the `preHandler` array.
**How to avoid:** Both POST `/draft` AND PATCH `/draft/:id` need `preHandler: [fastify.requireRole('owner', 'admin', 'reception')]`. Easy to forget on the second one.
**Warning signs:** A 200 response when a technician calls PATCH.

### Pitfall 6: Items array shape mismatch
**What goes wrong:** Existing `invoiceItemSchema` (line 11-19 of routes) marks `description`, `quantity`, `unitPrice`, `taxRate` as required. A draft with empty items is fine (CONTEXT D-05), but a draft with one half-filled item would fail validation.
**Why it happens:** The Zod schema is strict on individual items even though the whole array is optional.
**How to avoid:** Define a separate `draftInvoiceItemSchema` where every per-item field is `.optional()`, OR accept the constraint that draft items must be "complete enough to validate" (i.e., user can save a draft with no items, but not with broken items).
**Recommendation:** Make all per-item fields optional in the draft schema — auto-save fires on every keystroke, so a half-typed item must round-trip without error.

## Code Examples

### Example 1: Add `createDraft` to InvoicesService
```typescript
// Source: pattern derived from invoices.service.ts:58-103
async createDraft(tenantId: string, data: {
  type?: 'invoice' | 'quote' | 'credit_note';
  customerId?: string;
  orderId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  items?: Array<{ type?: 'labor' | 'part' | 'misc'; description?: string; quantity?: number; unitPrice?: number; unitCost?: number; taxRate?: number; unit?: string; sortOrder?: number }>;
}) {
  const draftNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;

  const [invoice] = await db.insert(invoices).values({
    tenantId,
    invoiceNumber: draftNumber,
    status: 'draft',
    type: data.type ?? 'invoice',
    customerId: data.customerId ?? null, // requires migration (Option B)
    orderId: data.orderId,
    issueDate: data.issueDate ?? null,   // requires migration (Option B)
    dueDate: data.dueDate,
    notes: data.notes,
  }).returning();

  if (data.items && data.items.length > 0) {
    await db.insert(invoiceItems).values(
      data.items
        .filter(i => i.description)  // skip blank items
        .map((item, idx) => ({
          invoiceId: invoice.id,
          type: item.type ?? 'misc',
          description: item.description!,
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? 0),
          unitCost: String(item.unitCost ?? 0),
          taxRate: String(item.taxRate ?? 20),
          unit: item.unit || null,
          sortOrder: item.sortOrder ?? idx,
        }))
    );
  }

  return this.getById(tenantId, invoice.id);
}
```

### Example 2: Add `updateDraft` to InvoicesService
```typescript
// Source: pattern derived from invoices.service.ts:148-193
async updateDraft(tenantId: string, id: string, data: {
  type?: 'invoice' | 'quote' | 'credit_note';
  customerId?: string;
  orderId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  items?: Array<{ /* same shape as createDraft */ }>;
}) {
  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
  });
  if (!existing) throw errors.notFound('Draft');
  if (existing.status !== 'draft') throw errors.badRequest('Only drafts can be updated via this endpoint');

  await db.update(invoices)
    .set({
      type: data.type ?? existing.type,
      customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
      orderId: data.orderId !== undefined ? data.orderId : existing.orderId,
      issueDate: data.issueDate !== undefined ? data.issueDate : existing.issueDate,
      dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

  if (data.items !== undefined) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (data.items.length > 0) {
      await db.insert(invoiceItems).values(
        data.items
          .filter(i => i.description)
          .map((item, idx) => ({
            invoiceId: id,
            type: item.type ?? 'misc',
            description: item.description!,
            quantity: String(item.quantity ?? 1),
            unitPrice: String(item.unitPrice ?? 0),
            unitCost: String(item.unitCost ?? 0),
            taxRate: String(item.taxRate ?? 20),
            unit: item.unit || null,
            sortOrder: item.sortOrder ?? idx,
          }))
      );
    }
  }

  return this.getById(tenantId, id);
}
```

### Example 3: Add routes in `invoices.routes.ts`
```typescript
// Source: pattern derived from invoices.routes.ts:52-66
import crypto from 'crypto';

const draftItemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']).optional(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  unit: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
});

const draftInvoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(draftItemSchema).optional(),
});

// Inside the plugin function, alongside existing routes:
fastify.post('/draft', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request, reply) => {
  const body = draftInvoiceSchema.parse(request.body);
  const draft = await invoicesService.createDraft(request.user.tenantId, body);
  return reply.code(201).send(draft);
});

fastify.patch('/draft/:id', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request) => {
  const { id } = request.params as { id: string };
  const body = draftInvoiceSchema.parse(request.body);
  return invoicesService.updateDraft(request.user.tenantId, id, body);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-level tenant filtering only | PostgreSQL RLS via `app.current_tenant_id` GUC | Migration 0003 (already applied) | Draft routes inherit isolation automatically — no extra work needed |
| `uuid` package import for ID generation | Built-in `crypto.randomUUID()` (Node ≥ 19) | N/A | Use built-in for new code; existing imports stay as-is |

**Deprecated/outdated:** Nothing relevant to this phase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAFT-01 | Invoice dialog auto-saves form data to DB as `status = draft` when user closes the dialog | Backend POST `/api/v1/invoices/draft` accepts partial payload with `status='draft'` set server-side; returns full invoice including `id` for subsequent updates. Phase 2 frontend will call this. |
| DRAFT-02 | Invoice dialog auto-saves to DB as draft when user navigates away from the invoices page while dialog is open | Same backend POST endpoint serves both triggers. Backend has no awareness of which client event triggered the call — both are identical HTTP requests. |

Note: DRAFT-03 (placeholder number) and DRAFT-04 (require ≥1 field filled) are also relevant — DRAFT-03 is implemented by `DRAFT-${uuid8}` (CONTEXT D-06); DRAFT-04 is enforced by frontend (Phase 2), backend accepts any payload per CONTEXT D-04.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New dedicated routes: `POST /api/v1/invoices/draft` (create) and `PATCH /api/v1/invoices/draft/:id` (update). Separate from existing `POST /api/v1/invoices` and `PATCH /api/v1/invoices/:id`.
- **D-02:** `POST /draft` returns the full invoice object (same shape as existing invoice responses), including the assigned `id` and placeholder `invoiceNumber`. Phase 2 stores this `id` for subsequent saves.
- **D-03:** `PATCH /draft/:id` merges provided fields with existing draft data — only supplied fields overwrite; missing fields stay as-is.
- **D-04:** No fields are required to create a draft — the JWT `tenantId` is sufficient. All invoice fields (`customerId`, `issueDate`, `items`, etc.) are optional.
- **D-05:** An empty items array is valid for a draft save.
- **D-06:** Draft number format = `DRAFT-` + 8-char UUID segment (e.g., `DRAFT-a3f2c1b8`). Unique, non-sequential, distinguishable from real invoice numbers.
- **D-07:** Roles permitted to call draft endpoints: `owner`, `admin`, `reception`. Technicians excluded.
- Draft number must NOT use the `invoiceCounter` sequence on `tenants` — generate independently.

### Claude's Discretion
- Internal service method naming (`upsertDraft` vs `createDraft`/`updateDraft`) — **chosen:** `createDraft` + `updateDraft` (mirrors existing `create` + `update`).
- Whether to reuse `invoicesService` or add a separate `draftsService` — **chosen:** extend the existing `invoicesService` (matches CONTEXT guidance and module pattern).
- Exact draft number format details (covered by D-06 above).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Compliance Plan |
|------------|--------|-----------------|
| **Tech stack:** Existing Fastify + Drizzle + React + TanStack Query — no new dependencies | CLAUDE.md > Constraints | All draft work uses existing libs; `crypto` is Node built-in. **No `package.json` changes.** |
| **Schema:** No migrations needed — `draft` status and `quote` type already in DB schema | CLAUDE.md > Constraints | **POTENTIAL CONFLICT** with CONTEXT D-04 — see "Schema Constraint Reconciliation" section. May require user clarification before plan finalisation. |
| File naming: `module.routes.ts` / `module.service.ts` | CLAUDE.md > File Naming | Editing existing `invoices.routes.ts` and `invoices.service.ts`; no new files. |
| Backend module pattern: Fastify plugin per module + class-based service singleton | CLAUDE.md > Backend Module Pattern | Extending the existing `InvoicesService` singleton. |
| `errors.notFound()` factory for 404s | CLAUDE.md > Backend Module Pattern | Use `errors.notFound('Draft')` and `errors.badRequest(...)` per existing pattern. |
| Strict TypeScript on backend | CLAUDE.md > TypeScript | All new code typed; partial payloads use optional types. |
| GSD workflow enforcement: file edits via GSD command | CLAUDE.md > GSD Workflow | This research is part of `/gsd-plan-phase` flow. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is preferred over the `uuid` package for new code in this codebase | Code Examples | Low — both work; reviewer may prefer `import { v4 } from 'uuid'`. Either choice satisfies CONTEXT D-06. |
| A2 | Frontend will store the `id` (UUID) returned from POST `/draft` and use it for subsequent PATCH calls | Architecture / DRAFT-02 mapping | Low — this is the standard pattern and CONTEXT D-02 explicitly says "Phase 2 stores this `id` for subsequent saves." |
| A3 | The global `setErrorHandler` correctly converts ZodError to 400 — no per-route try/catch needed | Common Pitfalls #4 | Low — verified at `app.ts:91-97`. |
| A4 | `customer_id` FK constraint allows NULL once NOT NULL is dropped (FKs only fire on non-NULL values) | Schema Constraint Reconciliation | Low — standard PostgreSQL FK behaviour. [VERIFIED: PostgreSQL docs] |
| A5 | Sentinel UUID `00000000-0000-0000-0000-000000000000` would be rejected by the FK because no customer with that id exists | Schema Constraint Reconciliation | High confidence — FK enforces referential integrity. This is why Option A "sentinel value" requires creating a placeholder customer row OR is unworkable; Option B (drop NOT NULL) is preferred. |
| A6 | `auto-save only triggers if at least one required field has been filled` (DRAFT-04) is enforced by the FRONTEND, not the backend | Phase Requirements | Low — backend is dumb per CONTEXT D-04. If reviewer interprets DRAFT-04 differently, planner must adjust. |
| A7 | "All fields optional" (D-04) supersedes CLAUDE.md "no migrations needed" because D-04 was decided after CLAUDE.md was written | Schema Constraint Reconciliation | **Medium** — this is the central planning question. Surface to user. |

## Open Questions

1. **Schema migration vs. require minimum payload (Option A/B/C)**
   - What we know: DB schema enforces `customer_id NOT NULL` and `issue_date NOT NULL`; CONTEXT D-04 says all fields optional.
   - What's unclear: User's preference between adding a migration (cleanest) vs. tightening the payload schema (no migration but contradicts D-04).
   - Recommendation: Add as planning question. Default to Option B (migration) if user does not respond — it is the only path that fully honours D-04.

2. **Should draft items with missing `description` be persisted or filtered out?**
   - What we know: `invoice_items.description` is `text NOT NULL`. A user mid-typing may have an item with all numeric fields filled but no description yet.
   - What's unclear: Drop those items silently, or also relax `invoice_items.description` to nullable.
   - Recommendation: Filter items where `description` is empty/missing during persistence (Code Example 1 already does this). Document in code. If user later wants those items kept, switch to a migration that nulls `description`.

3. **Cleanup of orphaned drafts**
   - What we know: A user could create dozens of `DRAFT-xxxx` rows by repeatedly opening and closing the dialog without filling anything.
   - What's unclear: Should there be a cron job to purge empty drafts older than N days?
   - Recommendation: Out of scope for Phase 1. Note for planner consideration in Phase 4 (UX Feedback) or post-MVP. Not a blocker.

4. **Idempotency on POST `/draft`**
   - What we know: Each POST creates a new row. A flaky network with retry could create two drafts.
   - What's unclear: Should we accept an optional client-provided idempotency key?
   - Recommendation: Out of scope for Phase 1. Phase 2 frontend should track the in-flight request and avoid concurrent POSTs (standard React Query pattern via `useMutation`). Not a blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v24 (per CLAUDE.md) | — |
| PostgreSQL 16 | Persistence | ✓ | 16-alpine via Docker | — |
| Docker / docker-compose | Local dev | Assumed ✓ | — | `npm run dev:backend` if Postgres available locally |
| Fastify 4.28.1 | HTTP server | ✓ | 4.28.1 | — |
| Drizzle ORM 0.33.0 | DB queries | ✓ | 0.33.0 | — |
| Zod 3.23.8 | Validation | ✓ | 3.23.8 | — |
| Node `crypto` | UUID generation | ✓ | built-in | `import { v4 } from 'uuid'` (already in deps) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

This phase requires no new external dependencies. All work happens in two existing files.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None detected** — no test files, no test runner in `package.json`, no `jest.config.*` / `vitest.config.*` / `pytest.ini` |
| Config file | none — see Wave 0 |
| Quick run command | `npm run build --workspace=backend` (TypeScript typecheck only) |
| Full suite command | `npm run build` (root — typechecks all workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAFT-01 (backend half) | POST `/api/v1/invoices/draft` accepts empty payload + returns 201 + draft id | manual + curl | `curl -X POST http://localhost:3009/api/v1/invoices/draft -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'` | manual |
| DRAFT-02 (backend half) | PATCH `/api/v1/invoices/draft/:id` merges fields without wiping items | manual + curl | `curl -X PATCH http://localhost:3009/api/v1/invoices/draft/$ID -H ... -d '{"notes":"x"}'` then verify items still present | manual |
| Success Criteria 1 | Partial payload accepted without 400 | manual | curl with `{}` body | manual |
| Success Criteria 2 | Returned `invoiceNumber` matches `^DRAFT-[a-f0-9]{8}$` | manual + grep | inspect response | manual |
| Success Criteria 3 | Second PATCH on same id updates rather than duplicates | manual + DB query | `psql ... SELECT count(*) FROM invoices WHERE id=$ID` returns 1 | manual |
| Success Criteria 4 | Endpoint callable via standard axios from browser | integration (Phase 2) | deferred to Phase 2 | — |
| TypeScript compiles | All new code passes `tsc --strict` | automated | `npm run build --workspace=backend` | ✓ |
| Roles enforced (owner/admin/reception only) | Technician gets 403 | manual + curl | `curl ... -H "Authorization: Bearer $TECH_TOKEN" ...` expects 403 | manual |
| Counter not consumed | `tenants.invoice_counter` unchanged after creating drafts | manual + DB query | `SELECT invoice_counter FROM tenants WHERE id=$T` before/after | manual |

### Sampling Rate
- **Per task commit:** `npm run build --workspace=backend` (TypeScript typecheck — only automated check)
- **Per wave merge:** Manual curl-based smoke test of POST then PATCH (use seed tenant from `db:seed`)
- **Phase gate:** All success criteria verified manually + counter integrity check via DB

### Wave 0 Gaps
- [ ] No automated test framework exists project-wide. Adding one (vitest / jest / supertest) is **out of scope** for this phase per CLAUDE.md "no new dependencies." Recommend the planner accept manual + typecheck-only verification for Phase 1 and surface "add test framework" as a deferred milestone-level task.
- [ ] If user wants automated coverage despite the no-deps constraint, the smallest viable addition is `node:test` (built-in, Node 18+) plus a small HTTP harness — no new packages required. Flag as discretionary.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `fastify.authenticate` plugin verifies JWT — already in place |
| V3 Session Management | partial | JWT access token + refresh token flow already implemented; draft routes are stateless |
| V4 Access Control | yes | `fastify.requireRole('owner','admin','reception')` per CONTEXT D-07 |
| V5 Input Validation | yes | Zod `.parse()` on every request body — schema validates UUIDs, enums, types |
| V6 Cryptography | yes | `crypto.randomUUID()` — Node built-in CSPRNG, never hand-rolled |
| V8 Data Protection | yes | RLS via `app.current_tenant_id` GUC isolates tenants at DB level (defence in depth) |
| V13 API & Web Service | yes | REST conventions: 201 on POST, JSON body, Bearer auth header |

### Known Threat Patterns for Fastify + Drizzle + PostgreSQL stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant access (one workshop reads another's drafts) | Information Disclosure | RLS policy `tenant_isolation` on `invoices` + service-level `WHERE tenant_id = $1` (defence in depth) — both already in place |
| SQL injection via items array | Tampering | Drizzle ORM uses parameterized queries throughout; never builds raw SQL strings from user input |
| Privilege escalation (technician edits drafts) | Elevation of Privilege | `requireRole('owner','admin','reception')` preHandler on every draft route |
| JWT replay after logout | Spoofing | Out of scope — handled by existing refresh token rotation in `auth.service.ts` |
| Mass assignment (client sets `tenantId` or `status='paid'`) | Tampering | Zod schema does NOT include `tenantId` or `status` in draft input; service explicitly hardcodes `status: 'draft'` and reads `tenantId` from JWT |
| ID enumeration / IDOR | Information Disclosure | RLS + `WHERE tenant_id = $1` ensures cross-tenant ID guesses return 404 |
| Rate-limit bypass via auto-save spam | DoS | `@fastify/rate-limit` registered globally at 100/min/IP. Phase 2 frontend should debounce. Backend has the safety net. |

## Sources

### Primary (HIGH confidence)
- `backend/src/modules/invoices/invoices.routes.ts` — existing route patterns, Zod schemas, role enforcement
- `backend/src/modules/invoices/invoices.service.ts` — existing `create()`, `update()`, `updateStatus()` patterns; counter increment lines 68-71
- `backend/src/db/schema/invoices.ts` — table definition, NOT NULL constraints
- `backend/src/db/migrations/0000_high_omega_red.sql` lines 178-193 — verified DB-level constraints on `invoices` table
- `backend/src/db/migrations/0003_tenant_rls.sql` — tenant isolation enforcement (RLS policies)
- `backend/src/plugins/auth.ts` — `authenticate` and `requireRole` decorator implementations
- `backend/src/utils/errors.ts` — `errors.notFound()`, `errors.badRequest()` factories
- `backend/src/app.ts` lines 91-97 — global `ZodError` handling
- `backend/src/db/index.ts` — `tenantDbStore` AsyncLocalStorage and Drizzle proxy
- `backend/package.json` — verified all dependencies (Fastify 4.28.1, Drizzle 0.33.0, Zod 3.23.8) already installed
- `.planning/phases/01-backend-draft-api/01-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — DRAFT-01 through DRAFT-10 definitions
- `CLAUDE.md` — project constraints (no new deps, no migrations needed)

### Secondary (MEDIUM confidence)
- None — all findings verified directly in the codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every library verified in `package.json`; all patterns traced to existing files
- Architecture: **HIGH** — extending established service+routes pattern; no new abstractions
- Pitfalls: **HIGH** — derived from reading existing `update()` and `create()` code paths
- Schema reconciliation: **HIGH on the conflict, MEDIUM on the recommended resolution** — Option B contradicts CLAUDE.md and needs user sign-off
- Validation: **HIGH** — confirmed no test framework exists; manual + typecheck is the only honest baseline

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable codebase, no fast-moving deps)
