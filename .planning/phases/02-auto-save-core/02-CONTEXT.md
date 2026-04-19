# Phase 2: Auto-Save Core - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire draft auto-save into `InvoiceDialog` — save on dialog close and route navigation away from the invoices page. Calls the Phase 1 draft endpoints. No backend changes, no new dependencies, no UI for viewing drafts (that's Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Auto-Save Timing
- **D-01:** Auto-save fires on two events only: (1) dialog close (X button, backdrop click, Abbrechen button) and (2) route navigation away while dialog is open. No debounced-while-typing saves in this phase.
- **D-02:** No `window.beforeunload` save attempt — async saves can't be reliably awaited there. Tab-close loss is acceptable for this phase.

### Minimum Content Gate
- **D-03:** Auto-save only fires if a customer has been selected (i.e., user got past step 1). No customer = no save.
- **D-04:** If user opens dialog, stays on step 1, and closes without selecting anyone — skip save entirely. No empty draft created.

### Navigation Guard Behavior
- **D-05:** When user navigates away (clicks sidebar) while dialog is open: silent save fires, navigation proceeds immediately. No block, no prompt. Phase 4 adds the visible save indicator.
- **D-06:** Use React Router `useBlocker` to intercept navigation, trigger save, then unblock. Silent to user.

### Finalize Flow (Draft → Real Invoice)
- **D-07:** When user completes the dialog and clicks "Rechnung erstellen" — if a draft exists for this session, call `POST /invoices` with full form data (normal create flow), then `DELETE /invoices/draft/:draftId` to remove the draft. Real sequential invoice number assigned by existing create path.
- **D-08:** Draft deletion on finalize is best-effort — if DELETE fails, log error but don't block the user. Draft orphan cleanup is Phase 3's concern.

### Draft ID Management
- **D-09:** Claude's discretion — store `draftId` in a `useRef` inside the dialog. Ref survives re-renders, resets when dialog unmounts. On dialog open with an existing draft invoice (Phase 3 flow), initialize ref from `invoice.id`.

### Claude's Discretion
- Exact debounce timing for the save call on close (if close triggers while save is in flight, coalesce)
- Whether to add `createDraft` / `updateDraft` / `deleteDraft` methods to `invoicesApi` object or inline the calls

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Key Files to Modify
- `frontend/src/pages/invoices/InvoiceDialog.tsx` — dialog to add auto-save logic
- `frontend/src/api/invoices.api.ts` — add `createDraft`, `updateDraft`, `deleteDraft` methods
- `frontend/src/pages/invoices/InvoicesPage.tsx` — may need `useBlocker` wiring if blocker lives at page level

### Phase 1 API Endpoints (already implemented)
- `POST /api/v1/invoices/draft` — create draft, returns full invoice with `id` and `invoiceNumber`
- `PATCH /api/v1/invoices/draft/:id` — update draft (merge, all fields optional)
- DELETE endpoint for draft: needs to be confirmed as implemented in Phase 1 or added in Phase 2

### Requirements
- `.planning/REQUIREMENTS.md` — DRAFT-01 through DRAFT-04 are in scope for this phase
- `.planning/ROADMAP.md` — Phase 2 success criteria (all 4 must be TRUE)

### Prior Context
- `.planning/phases/01-backend-draft-api/01-CONTEXT.md` — Phase 1 decisions (endpoint design, payload, draft number format, role auth)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InvoiceDialog.tsx` `useEffect` watching `open` — already handles reset on close; auto-save hook into this effect
- `invoicesApi` object — extend with `createDraft(data)`, `updateDraft(id, data)`, `deleteDraft(id)` matching existing API pattern
- React Router `useBlocker` (v6.7+) — available via existing `react-router-dom` dep, no new install needed
- `toast` from `@/hooks/use-toast` — use for save-failure notification (Phase 4 adds success indicator)

### Established Patterns
- `useMutation` from TanStack Query for API calls in dialog (existing `createInvoiceMutation`, `updateInvoiceMutation`)
- `onError` → toast destructive notification (existing `onMutationError` helper in dialog)
- Dialog close controlled by `onOpenChange={(o) => !o && onClose()}` on `Dialog.Root`

### Integration Points
- `InvoiceDialog` receives `open: boolean` and `onClose: () => void` from `InvoicesPage`
- `selectedCustomer` state already exists in dialog — gate check reads this
- Navigation blocker (`useBlocker`) likely needs to live in `InvoicesPage` or `InvoiceDialog`, where `open` state is accessible

### Note on DELETE endpoint
- Phase 1 added `POST /draft` and `PATCH /draft/:id`. Planner must verify whether `DELETE /invoices/draft/:id` was also implemented in Phase 1 or needs to be added in this phase's backend work.

</code_context>

<specifics>
## Specific Ideas

- D-07 finalize flow: call real `POST /invoices` then `DELETE /draft/:id` — not a status update on the draft. Real invoice number comes from the existing sequential counter on that path.
- D-08: draft deletion is best-effort (fire-and-forget on finalize). Orphan cleanup is Phase 3's problem.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-auto-save-core*
*Context gathered: 2026-04-19*
