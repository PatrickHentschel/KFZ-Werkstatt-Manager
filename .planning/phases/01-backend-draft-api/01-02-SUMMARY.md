---
phase: 01-backend-draft-api
plan: "02"
subsystem: api
tags: [fastify, drizzle, zod, invoices, draft, typescript]

requires:
  - phase: 01-01
    provides: [nullable-customerId, nullable-issueDate, draft-db-schema]
provides:
  - POST /api/v1/invoices/draft endpoint (createDraft, status=draft, DRAFT-xxxxxxxx number)
  - PATCH /api/v1/invoices/draft/:id endpoint (updateDraft, partial-merge semantics)
  - InvoicesService.createDraft() method
  - InvoicesService.updateDraft() method
affects: [frontend-invoice-dialog, frontend-drafts-tab, phase-02-frontend]

tech-stack:
  added: []
  patterns:
    - "Draft-specific service methods alongside existing create/update — no separate service"
    - "All-optional Zod schemas for partial draft payloads (draftItemSchema, draftInvoiceSchema)"
    - "DRAFT-xxxxxxxx invoice number via crypto.randomUUID() — never increments tenant counter"
    - "items-only-if-provided guard using data.items !== undefined for partial-merge PATCH"

key-files:
  created: []
  modified:
    - backend/src/modules/invoices/invoices.service.ts
    - backend/src/modules/invoices/invoices.routes.ts

key-decisions:
  - "createDraft never calls this.create() — isolates draft path from tenant invoice counter"
  - "PATCH /draft/:id uses same draftInvoiceSchema as POST (all fields optional) per D-03/D-04"
  - "Items filtered server-side for missing description (NOT NULL at DB level) rather than rejecting payload"
  - "reception role granted access alongside owner/admin per D-07 — technicians explicitly excluded"

patterns-established:
  - "Draft service methods placed after update() and before updateStatus() for grouping readability"
  - "New draft Zod schemas placed after updateInvoiceSchema and before plugin function declaration"

requirements-completed: [DRAFT-01, DRAFT-02]

duration: 25min
completed: 2026-04-19
---

# Phase 01 Plan 02: Draft Invoice Endpoints — Summary

**POST /draft and PATCH /draft/:id endpoints on InvoicesService with DRAFT-xxxxxxxx numbering, all-optional Zod validation, partial-merge items semantics, and role gate excluding technicians**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-19T08:00:00Z
- **Completed:** 2026-04-19T08:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `InvoicesService.createDraft()` inserts a draft invoice with `status='draft'`, server-generated `DRAFT-xxxxxxxx` invoice number via `crypto.randomUUID()`, without touching `tenants.invoiceCounter`
- `InvoicesService.updateDraft()` applies partial-merge semantics — fields absent from body are preserved from existing record; `items` only replaced when the key is explicitly present
- `POST /api/v1/invoices/draft` and `PATCH /api/v1/invoices/draft/:id` routes registered in the existing `invoicesRoutes` plugin with `requireRole('owner', 'admin', 'reception')` preHandler on both

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createDraft() and updateDraft() to InvoicesService** - `625fc46` (feat)
2. **Task 2: Add POST /draft and PATCH /draft/:id routes** - `1d323a3` (feat)

**Plan metadata:** (committed below)

## Files Created/Modified

- `backend/src/modules/invoices/invoices.service.ts` — Added `import crypto from 'crypto'`, `createDraft()` method (lines ~196-242), `updateDraft()` method (lines ~245-306)
- `backend/src/modules/invoices/invoices.routes.ts` — Added `draftItemSchema`, `draftInvoiceSchema` Zod schemas and `POST /draft`, `PATCH /draft/:id` route handlers

## Decisions Made

- `createDraft` is fully independent of `create()` — hardcodes `status: 'draft'`, generates `DRAFT-xxxxxxxx` number, and never calls `this.create()`. This is the primary correctness guarantee that drafts do not consume the tenant sequential counter.
- Items missing a `description` are filtered out silently rather than returning a 400. This allows the frontend to send partially typed item rows without API errors (the `invoice_items.description` column is NOT NULL at the DB level).
- `updateDraft` uses `data.items !== undefined` to distinguish "send no items key" (leave items unchanged) from "send empty array" (delete all items). This mirrors the existing `update()` method pattern exactly.
- `reception` role is included alongside `owner`/`admin` per D-07 — this is intentional. Technician role is excluded.

## Deviations from Plan

None — plan executed exactly as written. The two new service methods and two new routes were added without modifying any existing method or route.

## Issues Encountered

**Pre-existing TypeScript errors (not caused by this plan):**
- `@werkstatt/shared` module not found — shared package not built (`dist/` missing)
- `nodemailer` Attachment type mismatch

These 3 errors existed before this plan ran (documented in 01-01-SUMMARY) and remain unresolved. `npx tsc --noEmit` outputs only these 3 pre-existing errors — no new errors from our changes.

**Manual curl smoke tests:** Could not be run in parallel worktree execution (no live Docker services). The TypeScript compilation and grep-based acceptance criteria all pass. Smoke tests should be run post-merge against `docker compose up backend db`:

1. `curl -X POST http://localhost:3009/api/v1/invoices/draft -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{}'` — expected: 201 + body with `"status":"draft"` and `"invoiceNumber":"DRAFT-` followed by 8 hex chars.
2. Capture `id`. `curl -X PATCH http://localhost:3009/api/v1/invoices/draft/$ID -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"notes":"hello"}'` — expected: 200 + `"notes":"hello"`, same `id` and `invoiceNumber`.
3. `curl -X POST http://localhost:3009/api/v1/invoices/draft -H "Authorization: Bearer $TECH_TOKEN" ...` — expected: 403.
4. `SELECT invoice_counter FROM tenants WHERE id='$TENANT'` before and after creating 3 drafts — expected: counter unchanged.
5. `curl -X PATCH http://localhost:3009/api/v1/invoices/draft/00000000-0000-0000-0000-000000000000 ...` — expected: 404.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Backend half of DRAFT-01 and DRAFT-02 complete
- Phase 2 (frontend) can now consume `POST /api/v1/invoices/draft` to persist partial invoice form state and `PATCH /api/v1/invoices/draft/:id` for auto-save updates
- No further backend changes needed for the draft save feature

## Known Stubs

None — both endpoints are fully wired to the database via `InvoicesService`. No placeholder values or hardcoded mock data.

## Threat Flags

None — all T-02-01 through T-02-11 threats from the plan's threat model are mitigated by the implementation:
- JWT authentication via plugin-level hook (T-02-01)
- Zod allowlist strips unknown fields including `tenantId`, `status`, `invoiceNumber`, `paidAt` (T-02-02)
- Drizzle parameterized queries throughout (T-02-03)
- Explicit `AND tenant_id = $1` in all queries plus RLS (T-02-05)
- `requireRole('owner', 'admin', 'reception')` on both routes (T-02-09)
- `status !== 'draft'` guard in `updateDraft` (T-02-10)
- `createDraft` never calls `this.create()` (T-02-11)

## Self-Check: PASSED

- [x] `backend/src/modules/invoices/invoices.service.ts` has `import crypto from 'crypto'` at line 2
- [x] `createDraft` method present at line 196
- [x] `updateDraft` method present at line 245
- [x] `DRAFT-${crypto.randomUUID()...}` pattern at line 207
- [x] `status: 'draft'` hardcoded at line 212
- [x] `throw errors.notFound('Draft')` at line 257
- [x] `throw errors.badRequest('Only drafts can be updated via this endpoint')` at line 258
- [x] `data.items !== undefined` count = 2 (in `update()` and `updateDraft()`)
- [x] `invoiceCounter` still referenced 3 times (in original `create()` method — unchanged)
- [x] `export const invoicesService = new InvoicesService()` at line 310
- [x] `fastify.post('/draft'` at line 95 of routes file
- [x] `fastify.patch('/draft/:id'` at line 106 of routes file
- [x] `requireRole('owner', 'admin', 'reception')` count = 2
- [x] `draftItemSchema` and `draftInvoiceSchema` declared
- [x] `reply.code(201).send(draft)` for POST route
- [x] Commits 625fc46 and 1d323a3 exist in git log
- [x] `npx tsc --noEmit` outputs only 3 pre-existing errors (no new errors)

---
*Phase: 01-backend-draft-api*
*Completed: 2026-04-19*
