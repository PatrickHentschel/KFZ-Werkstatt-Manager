---
plan: 02-03
phase: 02-auto-save-core
status: complete
completed: 2026-04-20
---

## Summary

Wired close-time auto-save into `InvoiceDialog`, added finalize-time draft cleanup, seeded `draftIdRef` for edit-mode re-opens, and fixed the "Alle" tab to exclude drafts.

## What Was Built

**InvoiceDialog.tsx:**
- `draftIdRef = useRef<string | null>(null)` — tracks the draft ID across the dialog lifecycle
- `performDraftSave()` — fire-and-forget async function: skips if no customer, POSTs `createDraft` on first save (stores returned id in ref), PATCHes `updateDraft` on subsequent closes; shows destructive toast on failure but does not block close
- `handleClose()` — unified close handler that calls `void performDraftSave()` then `onClose()`; used by `onOpenChange`, X button (via Dialog.Root), and Abbrechen button
- Edit-mode seeding: when `invoice.status === 'draft'`, `draftIdRef.current = invoice.id` so subsequent closes PATCH instead of POST
- Reset: `draftIdRef.current = null` when `!open` to clear state between opens
- Finalize cleanup: `createInvoiceMutation.onSuccess` fires `void invoicesApi.deleteDraft(draftIdRef.current)` when a draftId exists

**InvoicesPage.tsx:**
- "Alle" tab passes `statuses: 'sent,paid,cancelled'` to exclude drafts from the default list view (DRAFT-06)

## Key Files

- `frontend/src/pages/invoices/InvoiceDialog.tsx` — draftIdRef, performDraftSave, handleClose, edit seeding, finalize cleanup
- `frontend/src/pages/invoices/InvoicesPage.tsx` — Alle tab statuses filter

## Deviations

None. Plan executed as specified.

## Self-Check: PASSED
