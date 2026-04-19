---
phase: 01-backend-draft-api
verified: 2026-04-19T09:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm live PostgreSQL column nullability after DDL-direct migration"
    expected: "information_schema.columns shows customer_id.is_nullable=YES and issue_date.is_nullable=YES for the invoices table"
    why_human: "Migration was applied via direct docker exec psql (not npm run db:migrate) due to catch-up conflict. SUMMARY claims success. Cannot verify live DB state programmatically without running Docker services."
  - test: "Run curl smoke tests against live backend"
    expected: "(1) POST /draft with {} returns 201 + body with status=draft and invoiceNumber matching DRAFT-[a-f0-9]{8}. (2) PATCH /draft/:id with {notes:hello} returns 200 with notes=hello, same id/invoiceNumber. (3) Technician token on either endpoint returns 403. (4) invoice_counter in tenants table unchanged after creating 3 drafts. (5) PATCH /draft/00000000-0000-0000-0000-000000000000 returns 404."
    why_human: "Smoke tests were intentionally deferred in SUMMARY (no live Docker during worktree execution). Programmatic verification of HTTP behavior requires running services."
---

# Phase 1: Backend Draft API — Verification Report

**Phase Goal:** Backend support for draft invoices — nullable schema columns + POST /draft and PATCH /draft/:id endpoints — so Phase 2 frontend auto-save can persist partial invoice form state without consuming tenant's sequential invoice counter.
**Verified:** 2026-04-19T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Drizzle schema for `invoices.customerId` is nullable (no `.notNull()`) | VERIFIED | `backend/src/db/schema/invoices.ts` line 15: `customerId: uuid('customer_id').references(() => customers.id)` — no `.notNull()` chained |
| 2 | Drizzle schema for `invoices.issueDate` is nullable (no `.notNull()`) | VERIFIED | `backend/src/db/schema/invoices.ts` line 17: `issueDate: date('issue_date')` — no `.notNull()` chained |
| 3 | New migration file exists containing both DROP NOT NULL statements | VERIFIED | `backend/src/db/migrations/0010_messy_radioactive_man.sql` exists and contains `ALTER TABLE "invoices" ALTER COLUMN "customer_id" DROP NOT NULL` and `ALTER TABLE "invoices" ALTER COLUMN "issue_date" DROP NOT NULL` |
| 4 | Migration applied to live PostgreSQL database | ? UNCERTAIN | SUMMARY documents DDL applied via direct `docker exec psql` (deviation from plan due to catch-up conflict). Cannot confirm live DB state without running Docker. Requires human verification. |
| 5 | POST /api/v1/invoices/draft accepts empty body and returns 201 + DRAFT-xxxxxxxx invoice | VERIFIED | Route `fastify.post('/draft', ...)` exists at line 95 of routes file; `createDraft` inserts with `status:'draft'` and `invoiceNumber: DRAFT-${crypto.randomUUID()...}`. No stub patterns found. |
| 6 | PATCH /api/v1/invoices/draft/:id applies partial-merge and leaves items unchanged when not in body | VERIFIED | `updateDraft` at line 245 of service: partial-merge semantics via `!== undefined` guards; `data.items !== undefined` gate for items replacement (line 274). |
| 7 | Technician role gets 403 from both endpoints | VERIFIED | `requireRole('owner', 'admin', 'reception')` present on BOTH routes (2 occurrences confirmed via grep). Technician is not in the allowed list. |
| 8 | Draft creation does NOT increment tenants.invoice_counter | VERIFIED | `createDraft` never calls `this.create()`. Invoice number generated via `crypto.randomUUID()`. `invoiceCounter` only referenced in original `create()` method. |
| 9 | PATCH /draft/:id on non-existent id returns 404; on non-draft returns 400 | VERIFIED | `updateDraft` line 257: `throw errors.notFound('Draft')` when not found; line 258: `throw errors.badRequest('Only drafts can be updated via this endpoint')` when status !== 'draft' |
| 10 | PATCH /draft/:id route is reachable (not shadowed by PATCH /:id) | VERIFIED | find-my-way v8 confirmed programmatically: `PATCH /draft/abc-123` routes to the draft handler despite `PATCH /:id` being registered first. Static prefix "draft" takes priority over pure parametric route — CR-02 is a false positive. |

**Score:** 9/10 truths verified (1 uncertain pending human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/db/schema/invoices.ts` | Updated Drizzle schema with nullable customerId and issueDate | VERIFIED | Both columns present without `.notNull()`; `tenantId` and `invoiceNumber` retain `.notNull()` |
| `backend/src/db/migrations/0010_messy_radioactive_man.sql` | New SQL migration file dropping NOT NULL constraints | VERIFIED | File exists; contains both `DROP NOT NULL` ALTERs plus catch-up statements for prior schema drift |
| `backend/src/modules/invoices/invoices.service.ts` | `createDraft(tenantId, data)` method on InvoicesService | VERIFIED | Method at line 196; substantive implementation with DB insert, UUID generation, item filtering, and `getById` return |
| `backend/src/modules/invoices/invoices.service.ts` | `updateDraft(tenantId, id, data)` method on InvoicesService | VERIFIED | Method at line 245; substantive implementation with existence check, status guard, partial-merge update, conditional item replacement |
| `backend/src/modules/invoices/invoices.routes.ts` | POST /draft and PATCH /draft/:id with role enforcement | VERIFIED | Both routes present (lines 95, 106); `requireRole('owner', 'admin', 'reception')` on each |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `invoices.routes.ts` POST /draft | `invoicesService.createDraft` | direct call after Zod parse | VERIFIED | Line 99: `invoicesService.createDraft(request.user.tenantId, body)` |
| `invoices.routes.ts` PATCH /draft/:id | `invoicesService.updateDraft` | direct call after Zod parse | VERIFIED | Line 111: `invoicesService.updateDraft(request.user.tenantId, id, body)` |
| `invoicesService.createDraft` | PostgreSQL invoices table | `db.insert(invoices).values({status:'draft', invoiceNumber:'DRAFT-...'})` | VERIFIED | Line 209: `db.insert(invoices).values(...)` with hardcoded `status:'draft'` and UUID-based invoice number |
| Both draft routes | `fastify.requireRole` | preHandler array | VERIFIED | `requireRole('owner', 'admin', 'reception')` appears exactly twice in routes file — once per new route |
| `backend/src/db/schema/invoices.ts` | `backend/src/db/migrations/0010_messy_radioactive_man.sql` | drizzle-kit generate diff | VERIFIED | Migration file exists and contains the two `DROP NOT NULL` statements matching the schema change |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `invoicesService.createDraft` | `invoice` | `db.insert(invoices).values(...).returning()` | Yes — DB insert returning real row | FLOWING |
| `invoicesService.updateDraft` | `existing` | `db.query.invoices.findFirst(...)` | Yes — DB query with tenant+id filter | FLOWING |
| `invoicesService.createDraft` return | full invoice object | `this.getById(tenantId, invoice.id)` | Yes — queries with customer and items joins | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Module exports createDraft | `node -e "const s = require('./backend/src/modules/invoices/invoices.service'); console.log(typeof s.invoicesService.createDraft)"` | Cannot run — TypeScript source requires compilation | ? SKIP |
| Route file contains /draft registration | grep check | `fastify.post('/draft'` at line 95, `fastify.patch('/draft/:id'` at line 106 | PASS |
| find-my-way route priority | Programmatic test with find-my-way v8 | `PATCH /draft/abc-123` resolves to draft handler, not generic `/:id` handler | PASS |

Step 7b: Partial SKIP — no compiled entry point available without running `tsc`. Static grep and programmatic router test used as substitutes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DRAFT-01 | 01-01, 01-02 | Invoice dialog auto-saves form data to DB as status=draft when user closes dialog | SATISFIED | `POST /api/v1/invoices/draft` accepts empty payload, inserts draft invoice, returns 201 with draft id for frontend storage |
| DRAFT-02 | 01-01, 01-02 | Invoice dialog auto-saves to DB as draft when user navigates away while dialog is open | SATISFIED | Same endpoint serves both trigger events (dialog-close and route-navigation) — no backend distinction needed |

**Note on DRAFT-03:** DRAFT-03 ("Draft invoice created with DRAFT-{uuid-short} placeholder") is assigned to Phase 2 in ROADMAP.md, but the implementation delivers this behavior as part of `createDraft`. This is not a gap — it is delivered early. Phase 2 plans should acknowledge it as already implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODOs, FIXMEs, placeholder returns, empty handlers, or hardcoded empty data found in any modified file. The `customerId: data.customerId ?? null` pattern in `createDraft` is correct behavior (nullable by design), not a stub.

### Human Verification Required

#### 1. Live Database Nullability Confirmation

**Test:** Connect to the running PostgreSQL instance and run:
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('customer_id', 'issue_date', 'tenant_id', 'invoice_number')
ORDER BY column_name;
```
**Expected:**
```
 column_name    | is_nullable
----------------+-------------
 customer_id    | YES
 invoice_number | NO
 issue_date     | YES
 tenant_id      | NO
```
**Why human:** Migration was applied via `docker exec psql` directly (documented deviation in 01-01-SUMMARY) due to catch-up migration conflict. The journal entry was backfilled manually. The SUMMARY asserts this was verified, but the live DB state cannot be confirmed programmatically without running Docker services.

#### 2. Curl Smoke Tests Against Live Backend

**Test:** With `docker compose up backend db` running:

1. `curl -X POST http://localhost:3009/api/v1/invoices/draft -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{}'`
   - Expected: HTTP 201, body contains `"status":"draft"`, `"invoiceNumber"` matches `DRAFT-[a-f0-9]{8}`

2. Capture the returned `id`. `curl -X PATCH http://localhost:3009/api/v1/invoices/draft/$ID -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"notes":"hello"}'`
   - Expected: HTTP 200, `"notes":"hello"`, same `id` and `invoiceNumber` as step 1

3. `curl -X POST http://localhost:3009/api/v1/invoices/draft -H "Authorization: Bearer $TECH_TOKEN" -H "Content-Type: application/json" -d '{}'`
   - Expected: HTTP 403

4. Query `SELECT invoice_counter FROM tenants WHERE id='$TENANT_ID'` before, create 3 drafts, re-query — counter must be unchanged

5. `curl -X PATCH http://localhost:3009/api/v1/invoices/draft/00000000-0000-0000-0000-000000000000 -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{}'`
   - Expected: HTTP 404

**Why human:** Smoke tests were explicitly deferred in 01-02-SUMMARY due to no live Docker services during worktree execution. These are the plan's own acceptance criteria — they must be run before marking Phase 1 as complete.

### CR-02 False Positive Notice

The known issue CR-02 ("PATCH /:id registered before PATCH /draft/:id — updateDraft is dead code") is a **false positive**.

find-my-way v8 (the router underlying Fastify 4) uses a radix tree with specificity-based priority. A route with a static prefix segment ("draft") before a parameter always takes priority over a pure parametric route at the same level, regardless of registration order.

Programmatic confirmation:
- `PATCH /draft/abc-123` → resolves to the `/draft/:id` handler
- `PATCH /real-uuid` → resolves to the `/:id` handler

No gap exists here. `updateDraft` is fully reachable.

### Gaps Summary

No code gaps found. All artifacts are substantive, wired, and data-flowing.

The only open item is operational: the live database migration must be confirmed by a human with Docker access, and the plan's own curl smoke tests must be run against the live backend. These were deferred during worktree execution (documented in SUMMARY) and are the final gate before Phase 1 can be declared complete.

---

_Verified: 2026-04-19T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
