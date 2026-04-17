# Phase 1: Backend Draft API - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend gains two new endpoints — `POST /api/v1/invoices/draft` and `PATCH /api/v1/invoices/draft/:id` — that accept partial invoice data, save it as `status=draft`, and assign a placeholder invoice number (never touching the real sequential counter). No frontend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Endpoint Design
- **D-01:** New dedicated routes: `POST /api/v1/invoices/draft` (create) and `PATCH /api/v1/invoices/draft/:id` (update). These are separate from existing `POST /api/v1/invoices` and `PATCH /api/v1/invoices/:id`.
- **D-02:** `POST /draft` returns the full invoice object (same shape as existing invoice responses), including the assigned `id` and placeholder `invoiceNumber`. Phase 2 stores this `id` for subsequent saves.
- **D-03:** `PATCH /draft/:id` merges provided fields with existing draft data — only supplied fields overwrite; missing fields stay as-is.

### Minimum Payload
- **D-04:** No fields are required to create a draft — the JWT `tenantId` is sufficient. All invoice fields (`customerId`, `issueDate`, `items`, etc.) are optional.
- **D-05:** An empty items array is valid for a draft save.

### Draft Number Format
- **D-06:** Claude's discretion — user did not specify exact format. Use `DRAFT-` + 8-char UUID segment (e.g., `DRAFT-a3f2c1b8`). This is unique, non-sequential, and clearly distinguishable from real invoice numbers.

### Authorization
- **D-07:** Roles permitted to call draft endpoints: `owner`, `admin`, `reception`. Technicians are excluded.

### Claude's Discretion
- Draft number format specifics (see D-06 above)
- Internal service method naming (`upsertDraft` vs `createDraft`/`updateDraft`)
- Whether to reuse `invoicesService` or add a separate `draftsService` — follow existing module pattern (extend the existing service)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Schema
- `backend/src/db/schema/invoices.ts` — Invoice and InvoiceItem table definitions; `invoiceStatusEnum` already includes `draft`; `invoiceNumber` is NOT NULL (placeholder required)

### Existing Service
- `backend/src/modules/invoices/invoices.service.ts` — Existing `create()` method increments tenant counter; draft endpoint must NOT call this path. `update()` method may be partially reusable.

### Existing Routes
- `backend/src/modules/invoices/invoices.routes.ts` — New draft routes register in this file alongside existing routes

### Requirements
- `.planning/REQUIREMENTS.md` — DRAFT-01 and DRAFT-02 define the frontend triggers this backend will support

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InvoicesService` class (`invoices.service.ts`): extend with `createDraft()` and `updateDraft()` methods — same singleton pattern as existing methods
- `invoiceItemSchema` Zod schema (`invoices.routes.ts`): reuse for optional items validation in draft endpoints
- `errors.notFound()` factory: reuse for 404 on unknown draft ID in PATCH

### Established Patterns
- Fastify plugin routes with `fastify.authenticate` preHandler at plugin level
- Role enforcement via `fastify.requireRole(...)` per-route preHandler
- Zod `.parse()` for request body validation (throws → 400 via global error handler)
- Service methods receive `tenantId` as first param (RLS + explicit filter)

### Integration Points
- New routes register in `invoices.routes.ts` alongside existing invoice routes
- `invoicesService` singleton extended with draft methods
- Shared type `Invoice` from `invoices.ts` schema used as return type

</code_context>

<specifics>
## Specific Ideas

- User confirmed: roles `owner`, `admin`, `reception` for draft endpoints — explicitly no technicians
- Draft number must not use the `invoiceCounter` sequence on `tenants` table — generate independently

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-backend-draft-api*
*Context gathered: 2026-04-17*
