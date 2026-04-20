---
plan: 02-01
phase: 02-auto-save-core
status: complete
completed: 2026-04-20
---

## Summary

Added the missing platform gaps needed for Phase 2 frontend wiring: `deleteDraft` backend service method + route, and all three draft API methods on the frontend client.

## What Was Built

- `InvoicesService.deleteDraft(tenantId, id)` — deletes draft invoice + its items; throws 404 if not found, 400 if not a draft
- `DELETE /api/v1/invoices/draft/:id` Fastify route with `requireRole('owner', 'admin', 'reception')` guard, returns 204
- `DraftInvoicePayload` exported TypeScript type in `invoices.api.ts`
- `invoicesApi.createDraft`, `invoicesApi.updateDraft`, `invoicesApi.deleteDraft` client methods

## Key Files

- `backend/src/modules/invoices/invoices.service.ts` — `deleteDraft` method added after `updateDraft`
- `backend/src/modules/invoices/invoices.routes.ts` — DELETE `/draft/:id` route added after PATCH `/draft/:id`
- `frontend/src/api/invoices.api.ts` — `DraftInvoicePayload` type + 3 draft client methods

## Deviations

None. Plan executed as specified.

## Self-Check: PASSED
