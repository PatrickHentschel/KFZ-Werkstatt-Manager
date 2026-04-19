# Phase 2: Auto-Save Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 02-auto-save-core
**Areas discussed:** Auto-save timing, Minimum content gate, Navigation guard behavior, Finalize vs draft flow

---

## Auto-Save Timing

| Option | Description | Selected |
|--------|-------------|----------|
| On close + navigate only | Save fires once when dialog closes or user navigates away. Simpler, fewer API calls. | ✓ |
| Debounced typing + on close | Save fires ~2s after user stops typing, AND on close/navigate. More complex, data survives mid-edit crashes. | |
| You decide | Claude picks the simpler approach. | |

**User's choice:** On close + navigate only
**Notes:** Keep it simple for this phase. No mid-edit saves.

---

## Minimum Content Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Customer selected | Only save if user got past step 1 and picked a customer. Prevents empty drafts. | ✓ |
| Any form field dirty | Save if any field was touched/changed. | |
| Customer + at least one item | Only save if customer selected AND at least one line item added. | |

**User's choice:** Customer selected

| Option | Description | Selected |
|--------|-------------|----------|
| No, skip save | No customer = nothing meaningful to save. | ✓ |
| Yes, save empty draft | Create draft with no customerId. Backend allows it. | |

**User's choice (step 1 no customer):** No, skip save

---

## Navigation Guard Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent save then navigate | Save fires, navigation proceeds immediately. No interruption. | ✓ |
| Block + save + navigate | Navigation blocked briefly, "Saving..." shown, then auto-proceed. | |
| Prompt: save or discard? | Confirm dialog before leaving. | |

**User's choice:** Silent save then navigate

| Option | Description | Selected |
|--------|-------------|----------|
| No, skip it | beforeunload can't await async calls reliably. Tab-close loss acceptable. | ✓ |
| Yes, best-effort save | Use sendBeacon or synchronous XHR on beforeunload. | |

**User's choice (beforeunload):** No, skip it

---

## Finalize vs Draft Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Promote draft to final | Call POST /invoices, then delete draft. Real number assigned. | ✓ |
| Just close without handling | Normal create flow always runs. Draft left as orphan. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** Promote draft to final

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the draft on finalize | After POST /invoices succeeds, DELETE /invoices/draft/:id. | ✓ |
| Leave draft, let Phase 3 handle | Don't touch draft on finalize this phase. | |

**User's choice (draft cleanup):** Delete the draft on finalize

---

## Claude's Discretion

- `draftId` storage: `useRef` inside `InvoiceDialog`
- Whether `createDraft`/`updateDraft`/`deleteDraft` land in `invoicesApi` or inline

## Deferred Ideas

None.
