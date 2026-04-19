# Phase 2: Auto-Save Core - Research

**Researched:** 2026-04-19
**Domain:** React dialog state + React Router navigation interception + TanStack Query mutations (frontend auto-save wiring)
**Confidence:** HIGH (on stack and patterns); HIGH (on blocker issue — see below)

## Summary

Phase 2 wires the frontend `InvoiceDialog` into the Phase 1 backend draft endpoints so closing the dialog or navigating away silently persists a draft. The work is a pure frontend slice: extend `invoicesApi` with three methods, add a `useRef` for `draftId`, add a close-time save effect, add a navigation-time save effect, and add a finalize-time draft cleanup. No backend changes, no new dependencies — with one exception described below.

**The single blocking discovery of this research**: the CONTEXT D-06 decision to "use React Router `useBlocker`" is **incompatible with the current `App.tsx`**, which uses declarative `BrowserRouter` (verified at `frontend/src/App.tsx:34`). `useBlocker` only works with data routers (`createBrowserRouter` + `RouterProvider`) and throws `"useBlocker must be used within a data router"` at runtime when called inside `BrowserRouter`. This is a HARD compile-free runtime error, not a warning. The planner MUST resolve this before any code is written.

Three viable resolutions (ranked by risk-to-scope):

1. **Migrate `App.tsx` to `createBrowserRouter` + `RouterProvider`** — cleanest, honours CONTEXT D-06 literally, but touches `App.tsx` which affects every route. Low-risk mechanical change (React Router v6.25.1 supports both APIs; existing `ProtectedRoute` + `AppShell` + `Routes` tree can be preserved by passing the JSX tree to a single root route element). **Recommended.**
2. **Use the `UNSAFE_NavigationContext` workaround** — no router change but relies on a React-Router-private API that could break on a patch upgrade. Violates the "no hacks" spirit of the codebase.
3. **Drop navigation-time save for this phase, only save on dialog close** — this directly contradicts DRAFT-02 and CONTEXT D-05/D-06, so it needs user sign-off before planning.

The planner should surface this choice to the user as the first planning decision.

Everything else in this phase is a straightforward composition of already-proven patterns: `useMutation` for API calls, `useRef` for the mutable `draftId`, `onOpenChange` interception on Radix Dialog, and a best-effort `deleteDraft` call on finalize.

**Primary recommendation:** Option 1 (migrate to `createBrowserRouter`). This unblocks `useBlocker`, is a ~40-line refactor in `App.tsx`, and brings the project onto the modern React Router data-router track for any future Phase 3/4 needs (loaders, actions).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auto-save fires on two events only: (1) dialog close (X button, backdrop click, Abbrechen button) and (2) route navigation away while dialog is open. No debounced-while-typing saves in this phase.
- **D-02:** No `window.beforeunload` save attempt — async saves can't be reliably awaited there. Tab-close loss is acceptable for this phase.
- **D-03:** Auto-save only fires if a customer has been selected. No customer = no save.
- **D-04:** If user opens dialog, stays on step 1, and closes without selecting anyone — skip save entirely. No empty draft created.
- **D-05:** When user navigates away (clicks sidebar) while dialog is open: silent save fires, navigation proceeds immediately. No block, no prompt.
- **D-06:** Use React Router `useBlocker` to intercept navigation, trigger save, then unblock. Silent to user.
- **D-07:** On "Rechnung erstellen" click — if a draft exists, call `POST /invoices` (normal create) then `DELETE /invoices/draft/:draftId`. Real sequential invoice number assigned by existing create path.
- **D-08:** Draft deletion on finalize is best-effort — if DELETE fails, log error but don't block the user.
- **D-09:** Store `draftId` in a `useRef` inside the dialog. Reset when dialog unmounts. On open-with-existing-draft (Phase 3 flow), initialize ref from `invoice.id`.

### Claude's Discretion
- Exact debounce timing for the save call on close (if close triggers while save is in flight, coalesce).
- Whether to add `createDraft` / `updateDraft` / `deleteDraft` methods to `invoicesApi` object or inline the calls — **recommended: add to `invoicesApi`** (matches existing pattern, keeps `InvoiceDialog.tsx` readable).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAFT-03 | Invoice dialog auto-saves to DB as draft when user closes (X / backdrop / Abbrechen) | Covered by on-close handler in `Dialog.Root onOpenChange`. Backend endpoint already exists (Phase 1 `POST /invoices/draft` and `PATCH /invoices/draft/:id`). Per CONTEXT D-03 + D-04, gate by `selectedCustomer !== null`. |
| DRAFT-04 | Dialog auto-saves when user navigates away while dialog open | Requires `useBlocker` — needs `createBrowserRouter` migration (see Summary). Alternative workarounds documented. |
| DRAFT-05 | Drafts show placeholder number `DRAFT-xxxx` | Already generated server-side by Phase 1 `createDraft()` — frontend needs no additional work; it just stores the returned `id` and displays whatever `invoiceNumber` the API returns. |
| DRAFT-06 | Auto-save only triggers if at least one required field has been filled | Per CONTEXT D-03, "required field" = `selectedCustomer !== null`. Enforced in frontend before calling API. Backend accepts empty payloads (Phase 1 CONTEXT D-04), so the gate is purely client-side. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect dialog close intent | Browser / Client | — | Radix `Dialog.Root onOpenChange` fires in the browser; React handler decides whether to save. |
| Detect route navigation intent | Browser / Client | — | React Router `useBlocker` (or fallback) intercepts client-side navigations before they commit. |
| Gate save by "customer selected" | Browser / Client | — | `selectedCustomer` state already lives in dialog; gate check is local. No server round-trip. |
| Persist draft state | API / Backend | Database / Storage | Phase 1 endpoints already implemented. Frontend just calls them. |
| Manage `draftId` lifecycle per dialog session | Browser / Client | — | `useRef` in dialog — survives re-renders, resets on unmount (D-09). |
| Generate placeholder invoice number | API / Backend | — | Server generates `DRAFT-xxxx` (Phase 1). Frontend never fabricates the number. |
| Show save-failure toast | Browser / Client | — | `@/hooks/use-toast` already wired; destructive variant reserved by UI-SPEC. |
| Finalize draft → real invoice + delete draft | API / Backend | Browser / Client | Two existing backend endpoints called sequentially from client. No new backend logic. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | UI runtime | [VERIFIED: frontend/package.json] Already in use across app |
| React Router DOM | 6.25.1 | Client-side routing + `useBlocker` | [VERIFIED: frontend/package.json]. `useBlocker` is stable in 6.4+ but **requires data router** (see Pitfall 1). |
| TanStack React Query | 5.51.11 | API call management (`useMutation`) | [VERIFIED: frontend/package.json] Existing pattern in `InvoiceDialog` already uses `useMutation` for create/update. |
| `@radix-ui/react-dialog` | ^1.1.2 | Dialog primitive with `onOpenChange` | [VERIFIED: frontend/package.json] Used everywhere for dialogs. |
| Zod | 3.23.8 | Type-safe form validation | [VERIFIED: frontend/package.json] Already wraps `useForm` in dialog. |
| React Hook Form | 7.52.1 | Form state (source of draft payload) | [VERIFIED: frontend/package.json] Already used — `watch()` or `getValues()` extract current form state for save. |

**Version verification:**
- `react-router-dom@6.25.1` verified against npm registry (`npm view react-router-dom@6.25.1 version` → `6.25.1`). Latest 6.x is 6.30.x; 7.x is a major with breaking changes — do NOT upgrade in this phase.
- `@tanstack/react-query@5.51.11` verified. Latest 5.x is 5.99.2; stay pinned per CLAUDE.md "no new dependencies."

**No installation required** — all dependencies already present. CLAUDE.md constraint "no new dependencies" satisfied.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | 1.7.3 | HTTP transport underneath `apiClient` | Already used. `invoicesApi.createDraft`/`updateDraft`/`deleteDraft` wrap it. |
| `@/hooks/use-toast` | local | Toast notifications | For save-failure destructive toast (UI-SPEC Interaction Contract). |
| `clsx` + `tailwind-merge` | existing | Class composition | Not new to this phase. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useBlocker` (requires data router migration) | `window.history.pushState` monkeypatch / `UNSAFE_NavigationContext` | Private API; breaks on React Router upgrades. Reject unless user explicitly accepts the risk. |
| `useBlocker` | `beforeunload` only (tab-close) | Doesn't intercept in-app sidebar clicks — fails DRAFT-04. |
| `useRef` for `draftId` (D-09 locked) | `useState` | State would cause re-render on save; ref matches CONTEXT exactly. |
| `mutateAsync` + await in close handler | Fire-and-forget `mutate` | Close handler needs to know success/failure to fire the right toast and proceed; use `mutateAsync` in `try/catch`. |
| Inline API calls in dialog | Add methods to `invoicesApi` | Method-on-object matches existing pattern; inline would be an outlier. |

**Installation:**
```bash
# No installation required — all dependencies already present
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│ InvoicesPage.tsx                                    │
│  • Controls dialogOpen state                        │
│  • Passes open/onClose to InvoiceDialog             │
└─────────────────────────┬───────────────────────────┘
                          │ open, onClose
                          ▼
┌─────────────────────────────────────────────────────┐
│ InvoiceDialog.tsx                                   │
│  ┌───────────────────────────────────────────────┐  │
│  │ useRef<draftId>     (survives re-renders)     │  │
│  │ useForm()           (form state source)       │  │
│  │ selectedCustomer    (gate check)              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Event: Dialog onOpenChange(false)                  │
│   └─► if (selectedCustomer)                         │
│        ├─ draftId ref null: createDraftMutation     │
│        │   └─► POST /api/v1/invoices/draft          │
│        │        └─► ref.current = response.data.id  │
│        └─ draftId ref set: updateDraftMutation      │
│            └─► PATCH /api/v1/invoices/draft/:id     │
│       onSuccess → onClose()                         │
│       onError   → toast(destructive) + onClose()    │
│                                                     │
│  Event: useBlocker detects nav away + dialog open   │
│   └─► same save logic, but fire-and-forget          │
│       then blocker.proceed() immediately (D-05)     │
│                                                     │
│  Event: "Rechnung erstellen" submit (D-07)          │
│   └─► createInvoiceMutation (existing path)         │
│        └─► on success:                              │
│             • invalidate invoices query             │
│             • if draftId.current:                   │
│               fire-and-forget deleteDraft (D-08)    │
│             • onClose()                             │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│ invoicesApi (frontend/src/api/invoices.api.ts)      │
│  • createDraft(data)  → POST   /invoices/draft      │
│  • updateDraft(id, d) → PATCH  /invoices/draft/:id  │
│  • deleteDraft(id)    → DELETE /invoices/draft/:id  │
└─────────────────────────┬───────────────────────────┘
                          │ axios + JWT interceptor
                          ▼
                  ┌───────────────┐
                  │ Fastify API   │
                  │ (Phase 1)     │
                  └───────────────┘
```

### Recommended Project Structure
No new files. All changes confined to:
```
frontend/src/
├── App.tsx                           # MODIFY: BrowserRouter → createBrowserRouter (enables useBlocker)
├── api/invoices.api.ts               # ADD: createDraft, updateDraft, deleteDraft
└── pages/invoices/
    ├── InvoiceDialog.tsx             # MODIFY: draftId ref, close-save handler, blocker wiring, finalize cleanup
    └── InvoicesPage.tsx              # (likely untouched — blocker lives in dialog, see Pattern 3)

backend/src/modules/invoices/
├── invoices.routes.ts                # ADD: DELETE /draft/:id
└── invoices.service.ts               # ADD: deleteDraft(tenantId, id)
```

### Pattern 1: Dialog close handler with async draft save
**What:** Hook into `Dialog.Root onOpenChange` to save before calling `onClose()`.
**When to use:** Every close path (X, backdrop, Abbrechen button all trigger `onOpenChange(false)`).
**Example:**
```typescript
// Replaces the current `onOpenChange={(o) => !o && onClose()}` line
const handleOpenChange = async (open: boolean) => {
  if (open) return;                               // only act on close
  if (!selectedCustomer) { onClose(); return; }   // D-04 gate
  try {
    const formData = getFormData();               // read react-hook-form via getValues()
    if (draftIdRef.current) {
      await updateDraftMutation.mutateAsync({ id: draftIdRef.current, data: formData });
    } else {
      const draft = await createDraftMutation.mutateAsync(formData);
      draftIdRef.current = draft.data.id;
    }
  } catch (err) {
    toast({
      variant: 'destructive',
      title: 'Entwurf konnte nicht gespeichert werden',
      description: 'Deine Eingaben sind noch sichtbar. Bitte versuche es erneut oder erstelle die Rechnung jetzt.',
    });
  } finally {
    onClose();                                     // never block close on save result (UI-SPEC)
  }
};
```
[CITED: UI-SPEC Interaction Contract, CONTEXT D-03/D-04]

### Pattern 2: useBlocker async-save pattern (DATA ROUTER REQUIRED)
**What:** React Router v6.4+ `useBlocker` intercepts in-app navigation. Blocker predicate is synchronous; the save happens in a `useEffect` watching `blocker.state`.
**When to use:** When dialog is open AND the user attempts to navigate away.
**Example:**
```typescript
// Source: https://reactrouter.com/how-to/navigation-blocking (adapted)
// Requires createBrowserRouter migration (see Pitfall 1).
import { useBlocker } from 'react-router-dom';
import { useEffect, useRef } from 'react';

// Inside InvoiceDialog (or InvoicesPage — see Pattern 3):
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    open && !!selectedCustomer && currentLocation.pathname !== nextLocation.pathname
);

useEffect(() => {
  if (blocker.state !== 'blocked') return;

  // D-05: silent save, proceed immediately. Fire-and-forget.
  const formData = getFormData();
  const savePromise = draftIdRef.current
    ? invoicesApi.updateDraft(draftIdRef.current, formData)
    : invoicesApi.createDraft(formData).then((r) => {
        draftIdRef.current = r.data.id;
      });

  // Do NOT await. Proceed to navigate now.
  savePromise.catch(() => {
    toast({
      variant: 'destructive',
      title: 'Entwurf konnte nicht gespeichert werden',
      description: 'Deine Eingaben sind noch sichtbar. Bitte versuche es erneut oder erstelle die Rechnung jetzt.',
    });
  });

  blocker.proceed();
}, [blocker.state]);
```
**Critical:** The blocker predicate must be synchronous (returns boolean). The async save lives in the effect, not in the predicate. [CITED: https://reactrouter.com/api/hooks/useBlocker]

### Pattern 3: Where the blocker lives
**What:** `useBlocker` must be called inside a component rendered by the Router. The blocker hook triggers even if the dialog is not currently mounted, so conditioning on `open` in the predicate matters.
**Recommendation:** Put it in `InvoiceDialog` itself — the component is always mounted while `open={true}` (Radix Dialog portals keep it in the React tree). This avoids threading `open` state up to `InvoicesPage` just for the blocker.
**Alternative:** Lift to `InvoicesPage` if testing surfaces edge cases where dialog unmounts too fast. Since Radix keeps portaled content mounted during the `onOpenChange` fire, the dialog-level placement is safe.

### Pattern 4: Finalize flow (D-07, D-08)
**What:** On "Rechnung erstellen", call the existing `createInvoiceMutation`, then fire-and-forget `deleteDraft` to clean up.
**Example:**
```typescript
const createInvoiceMutation = useMutation({
  mutationFn: (data: InvoiceForm) =>
    invoicesApi.create({ /* existing shape */ }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    toast({ title: 'Rechnung erstellt' });

    // D-07/D-08: best-effort draft cleanup
    if (draftIdRef.current) {
      invoicesApi.deleteDraft(draftIdRef.current)
        .catch((err) => console.warn('Draft cleanup failed:', err));
      draftIdRef.current = null;
    }

    onClose();
  },
  onError: (err: any) => onMutationError(err, 'Rechnung konnte nicht erstellt werden'),
});
```

### Pattern 5: `draftId` ref initialization on edit-mode open
**What:** When dialog opens with an `invoice` prop (edit flow — Phase 3), seed the ref from `invoice.id` if `invoice.status === 'draft'`.
**Example:**
```typescript
useEffect(() => {
  if (!open) {
    draftIdRef.current = null;       // reset on close
  } else if (invoice?.status === 'draft') {
    draftIdRef.current = invoice.id; // seed on re-open
  }
}, [open, invoice]);
```

### Anti-Patterns to Avoid
- **Making the `useBlocker` predicate async:** Doesn't work — the function is called synchronously on every navigation attempt. Async logic lives in the `useEffect` watching `blocker.state`.
- **Awaiting the save before `blocker.proceed()`:** Contradicts D-05 ("navigation proceeds immediately"). The save runs in the background while React Router navigates.
- **Using `useState` for `draftId`:** Causes re-render on every save success, which re-runs the close handler and could double-fire. CONTEXT D-09 specifies `useRef` for a reason.
- **Calling `updateDraft` when `draftId.current` is null:** The API returns 404. Always gate on `draftIdRef.current`.
- **Persisting draftId in localStorage:** Out of scope per REQUIREMENTS "Out of Scope" → "localStorage draft persistence."
- **Awaiting `deleteDraft` before the success toast on finalize:** Adds latency for no user benefit. D-08 says best-effort fire-and-forget.
- **Trying to debounce close events:** Close is a one-shot event; no debounce needed. If another save is in flight when close fires, use `mutateAsync` + the mutation will queue naturally in its own promise chain (CONTEXT "Claude's Discretion" — coalesce via ref-check).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Navigation interception | Monkeypatch `history.pushState` | React Router `useBlocker` | The official hook handles history stack, forward/back, and programmatic `navigate()` uniformly. |
| Form state extraction for save | Reach into dialog `useState` mirror | `useForm().getValues()` or `watch()` from react-hook-form | Already the source of truth — any duplicate state will drift. |
| Mutation state tracking | Manual `isLoading`/`error` `useState` | `useMutation` from TanStack | Handles race conditions, pending state, retry, and error propagation out of the box. |
| Promise racing for "save in flight during close" | Custom queue or lock | `mutateAsync` returns a promise you can await per call; TanStack handles retry/dedup internally | Dialog close handler naturally awaits the save — no custom queue needed. |
| Toast state management | Custom context + provider | Existing `@/hooks/use-toast` (already initialized via `Toaster` in app root) | Matches UI-SPEC Copywriting Contract. |
| Route-level guard UI (modal "unsaved changes?") | Custom modal | Out of scope — D-05 says silent | Don't build what the requirements forbid. |

**Key insight:** Every wire of this phase is already established in the codebase. The only new concept is connecting them — and the only novelty (`useBlocker`) is a stable React Router API with one clear prerequisite (data router).

## Common Pitfalls

### Pitfall 1: `useBlocker` inside `BrowserRouter` throws at runtime
**What goes wrong:** `App.tsx` renders `<BrowserRouter>`, so the first time the user opens the invoice dialog (which calls `useBlocker`), the app throws `"useBlocker must be used within a data router"` and the whole page errors out.
**Why it happens:** `useBlocker` is scoped to the data-router infrastructure (`createBrowserRouter` / `RouterProvider`). [CITED: https://reactrouter.com/api/hooks/useBlocker — the compatibility matrix explicitly lists "Declarative: ❌"]
**How to avoid:** Migrate `App.tsx` to `createBrowserRouter` + `RouterProvider`. The existing `<Route>` JSX tree can be preserved by wrapping it as the root route's element (minimal structural change). Alternative: accept the `UNSAFE_NavigationContext` workaround (not recommended — breaks on patch upgrades).
**Warning signs:** Dialog opens, then full-page error overlay appears in dev; in production the error boundary catches it and blanks the page.

### Pitfall 2: Radix Dialog `onOpenChange` fires both for open and close
**What goes wrong:** Naive `onOpenChange={async (o) => { await save(); onClose(); }}` fires `await save()` on open too, leading to a spurious POST when the dialog first appears.
**Why it happens:** Radix calls `onOpenChange(true)` and `onOpenChange(false)` — both emit through the same handler.
**How to avoid:** Gate on `if (open) return;` at the top of the handler. [CITED: https://www.radix-ui.com/primitives/docs/components/dialog]
**Warning signs:** Network tab shows a POST `/invoices/draft` every time the dialog opens.

### Pitfall 3: Closing via `Dialog.Close` button bypasses `onOpenChange`
**What goes wrong:** `<Dialog.Close asChild><Button>X</Button></Dialog.Close>` is currently used at line 269-271 of `InvoiceDialog`. Radix's `Dialog.Close` calls `onOpenChange(false)` internally, so it DOES go through the handler — this is safe. But a custom `<Button onClick={onClose}>` (like the "Abbrechen" button at line 615-628) calls `onClose` directly and bypasses the save.
**Why it happens:** The existing "Abbrechen" button invokes `onClose()` directly, not via Radix's `Dialog.Close`.
**How to avoid:** Either (a) route the Abbrechen button through `setOpen(false)`-style state that triggers `onOpenChange`, or (b) apply the same save logic in the Abbrechen `onClick`. Option (b) is simpler: wrap `onClose` in the same close-save handler and reuse.
**Warning signs:** Clicking X saves; clicking Abbrechen doesn't — draft lost.

### Pitfall 4: React Hook Form `getValues()` returns stale data on first render
**What goes wrong:** In unusual mounting orders, `getValues()` returns the `defaultValues` instead of the user's typed values.
**Why it happens:** Typically only in SSR or effect-ordering edge cases. In this project (CSR only, all-browser runtime), it shouldn't happen. Still worth validating via a smoke test.
**How to avoid:** Use `watch()` (which subscribes to changes) for the close handler's payload extraction, OR ensure `getValues()` runs inside a handler (not in render).

### Pitfall 5: `useBlocker` re-arms itself if you don't call `blocker.reset()` on unblock
**What goes wrong:** After save + `proceed()`, the next navigation also blocks, even if the dialog is now closed.
**Why it happens:** Blocker state persists across `proceed()` calls if the predicate function still returns `true`. The fix is to include the dialog `open` state in the predicate.
**How to avoid:** Include `open && selectedCustomer` in the predicate. When the dialog closes, `open` becomes false, predicate returns false, blocker sits idle. [CITED: https://github.com/remix-run/react-router/discussions/12747 — rjgotten's pattern calls `blocker.reset()` in cleanup for extra safety.]
**Warning signs:** Second navigation after a save also gets stuck in `blocked` state.

### Pitfall 6: Missing DELETE backend endpoint
**What goes wrong:** `invoicesApi.deleteDraft(id)` returns 404 because Phase 1 never shipped the DELETE route. D-08 says "best-effort," but a 404 on every finalize pollutes logs and risks fragility on Phase 3 cleanup.
**Why it happens:** [VERIFIED: `backend/src/modules/invoices/invoices.routes.ts`] only exports `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /draft`, `PATCH /draft/:id`, `PATCH /:id/status`, `POST /:id/send`, `GET /:id/pdf`. No DELETE.
**How to avoid:** Add `DELETE /api/v1/invoices/draft/:id` in this phase. Service method `deleteDraft(tenantId, id)` = `SELECT → verify status='draft' → DELETE (cascade handles items)`. This is a 20-line backend addition. The planner must include it even though CONTEXT frames this phase as "no backend changes" — the frontend cannot fulfil D-07 without it.
**Warning signs:** Browser console shows 404 on finalize; draft orphans accumulate.

### Pitfall 7: Race condition — user closes dialog before create-draft completes
**What goes wrong:** User types quickly, closes dialog. `createDraft` fires but hasn't returned. User reopens dialog and closes again. Two POSTs race; two drafts are created.
**Why it happens:** `draftIdRef.current` is null for both close handlers because the first create hasn't resolved yet.
**How to avoid:** Use `mutateAsync` and `await` in the close handler so the second close waits for the first. Since `useMutation.mutateAsync` promise chain is per-mutation-instance, calling `mutateAsync` twice in sequence will both fire but the ref assignment in the first `await` resolves before the second runs. Safer alternative: track a `draftCreationInFlight` ref that coalesces.
**Warning signs:** Duplicate drafts appear in the Entwürfe tab after rapid open/close cycles.

### Pitfall 8: `useNavigate` redirect from 401 interceptor + dialog open
**What goes wrong:** Token expires; `apiClient` interceptor refreshes or logs out and calls `navigate('/login')`. If dialog is open, `useBlocker` intercepts → attempts to save with expired token → hangs.
**Why it happens:** The blocker runs on every navigation, including auth-driven redirects.
**How to avoid:** The axios interceptor path triggers a `navigate()` that isn't user-initiated. Either (a) skip blocker on `/login` redirects (`nextLocation.pathname === '/login'`), or (b) bypass blocker entirely when auth fails. Simplest fix: exclude `/login` in the predicate. This is an edge case worth a smoke test.
**Warning signs:** After session expiry, clicking anywhere spins forever.

## Code Examples

### Example 1: Extend `invoicesApi` with draft methods
```typescript
// Source: frontend/src/api/invoices.api.ts — add to existing `invoicesApi` object
export const invoicesApi = {
  // ... existing methods

  createDraft: (data: DraftInvoicePayload) =>
    apiClient.post<Invoice>('/invoices/draft', data),

  updateDraft: (id: string, data: DraftInvoicePayload) =>
    apiClient.patch<Invoice>(`/invoices/draft/${id}`, data),

  deleteDraft: (id: string) =>
    apiClient.delete<void>(`/invoices/draft/${id}`),
};

// DraftInvoicePayload matches what the backend accepts (Phase 1):
// all fields optional; items[] has per-item optional fields.
export type DraftInvoicePayload = {
  type?: InvoiceType;
  customerId?: string;
  orderId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  items?: Array<{
    type?: 'labor' | 'part' | 'misc';
    description?: string;
    quantity?: number;
    unitPrice?: number;
    unitCost?: number;
    taxRate?: number;
    unit?: string;
    sortOrder?: number;
  }>;
};
```

### Example 2: Draft mutations inside `InvoiceDialog`
```typescript
// Source: pattern from existing createInvoiceMutation at InvoiceDialog.tsx:207-224
import { useRef } from 'react';

const draftIdRef = useRef<string | null>(null);

// Seed on edit-mode open, clear on close
useEffect(() => {
  if (!open) {
    draftIdRef.current = null;
  } else if (invoice?.status === 'draft') {
    draftIdRef.current = invoice.id;
  }
}, [open, invoice]);

const createDraftMutation = useMutation({
  mutationFn: (data: DraftInvoicePayload) => invoicesApi.createDraft(data),
  onSuccess: (res) => {
    draftIdRef.current = res.data.id;
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  },
});

const updateDraftMutation = useMutation({
  mutationFn: ({ id, data }: { id: string; data: DraftInvoicePayload }) =>
    invoicesApi.updateDraft(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  },
});
```

### Example 3: Close-save handler wiring Dialog + Abbrechen button
```typescript
// Source: replaces existing onOpenChange at InvoiceDialog.tsx:241 and
// Abbrechen onClick at InvoiceDialog.tsx:618-624
const { getValues } = useForm(...);

const performDraftSave = async (): Promise<void> => {
  if (!selectedCustomer) return;

  const payload: DraftInvoicePayload = {
    customerId: selectedCustomer.id,
    ...getValues(),
    items: getValues('items').map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
  };

  try {
    if (draftIdRef.current) {
      await updateDraftMutation.mutateAsync({ id: draftIdRef.current, data: payload });
    } else {
      await createDraftMutation.mutateAsync(payload);
    }
  } catch (err) {
    toast({
      variant: 'destructive',
      title: 'Entwurf konnte nicht gespeichert werden',
      description: 'Deine Eingaben sind noch sichtbar. Bitte versuche es erneut oder erstelle die Rechnung jetzt.',
    });
  }
};

const handleCloseRequested = async () => {
  await performDraftSave();
  onClose();
};

// In JSX:
<Dialog.Root open={open} onOpenChange={(o) => !o && handleCloseRequested()}>
  ...
  <Button type="button" variant="outline" onClick={handleCloseRequested}>
    Abbrechen
  </Button>
```

### Example 4: Navigation blocker (data router required)
```typescript
// Source: adapted from https://reactrouter.com/how-to/navigation-blocking
// AND https://github.com/remix-run/react-router/discussions/12747
import { useBlocker } from 'react-router-dom';

const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    open &&
    !!selectedCustomer &&
    currentLocation.pathname !== nextLocation.pathname &&
    nextLocation.pathname !== '/login' // pitfall 8
);

useEffect(() => {
  if (blocker.state !== 'blocked') return;

  // D-05: fire save, proceed immediately (no await)
  void performDraftSave();
  blocker.proceed();

  // Defensive: reset so next navigation isn't stuck
  return () => blocker.reset?.();
}, [blocker.state]);
```

### Example 5: Finalize flow with draft cleanup
```typescript
// Source: modifies existing createInvoiceMutation at InvoiceDialog.tsx:207-224
const createInvoiceMutation = useMutation({
  mutationFn: (data: InvoiceForm) =>
    invoicesApi.create({
      customerId: selectedCustomer!.id,
      /* ... existing payload ... */
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    toast({ title: 'Rechnung erstellt' });

    // D-07/D-08: best-effort cleanup
    const idToDelete = draftIdRef.current;
    if (idToDelete) {
      invoicesApi.deleteDraft(idToDelete)
        .catch((err) => console.warn('Draft cleanup failed:', err));
      draftIdRef.current = null;
    }

    onClose();
  },
  onError: (err: any) => onMutationError(err, 'Rechnung konnte nicht erstellt werden'),
});
```

### Example 6: Backend DELETE endpoint (needed in this phase)
```typescript
// backend/src/modules/invoices/invoices.routes.ts — add alongside PATCH /draft/:id
fastify.delete('/draft/:id', {
  preHandler: [fastify.requireRole('owner', 'admin', 'reception')],
}, async (request, reply) => {
  const { id } = request.params as { id: string };
  await invoicesService.deleteDraft(request.user.tenantId, id);
  return reply.code(204).send();
});
```
```typescript
// backend/src/modules/invoices/invoices.service.ts — add method
async deleteDraft(tenantId: string, id: string) {
  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
  });
  if (!existing) throw errors.notFound('Draft');
  if (existing.status !== 'draft') throw errors.badRequest('Only drafts can be deleted via this endpoint');

  // invoice_items cascade-delete via FK onDelete:'cascade' (verified in schema)
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
}
```

### Example 7: Router migration (App.tsx) — the key enabler
```typescript
// Source: https://reactrouter.com/en/main/upgrading/v6-data
// Replaces the existing BrowserRouter in App.tsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/demo-checkout', element: <DemoCheckoutPage /> },
  {
    path: '/',
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'customers', element: <CustomersPage /> },
      // ... remaining routes ...
      { path: 'payment-success', element: <PaymentSuccessPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Prompt>` component (v5) | `useBlocker` hook (v6.4+ data router) | React Router v6 (2022); blocker in v6.4 (Sep 2022) | Old `<Prompt>` is fully removed; `useBlocker` is the only supported path. Requires data router. |
| `BrowserRouter` + nested `<Routes>` | `createBrowserRouter` + `RouterProvider` | React Router v6.4 (2022) | Declarative still works but excludes the modern data APIs (loaders, actions, `useBlocker`). This phase forces the migration. |
| `uuid` package on frontend | N/A for this phase | — | No UUIDs generated client-side. Server owns draft IDs. |

**Deprecated/outdated:**
- `<Prompt>` (React Router v5) — removed in v6.
- `usePrompt` (experimental v6.0.x) — removed; superseded by `useBlocker`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Abbrechen button in the dialog footer bypasses `onOpenChange` because it calls `onClose()` directly | Pitfall 3 | Low — verified by reading `InvoiceDialog.tsx:615-628`. If wrong, the save just fires twice (still safe — backend PATCH is idempotent). |
| A2 | Radix Dialog keeps portaled content mounted long enough for an async `onOpenChange` handler to complete before unmount | Pattern 3 | Medium — confirmed by the general Radix pattern (Dialog.Root owns open state), but not explicitly verified via Radix docs for async handlers. If it unmounts mid-save, the mutation continues but the toast may render on a different page. Acceptable per UI-SPEC. |
| A3 | The existing axios interceptor (`frontend/src/api/client.ts`) correctly handles 401 with token refresh for draft endpoints too | Pitfall 8 | Low — interceptor is agnostic to endpoint path. |
| A4 | `mutateAsync` in `useMutation` v5 correctly rejects when the network call fails and the `onError` callback still fires | Example 3, Pattern 1 | Low — standard v5 behaviour, [CITED: TanStack docs]. |
| A5 | Migrating from `BrowserRouter` to `createBrowserRouter` does not break `ProtectedRoute` or `AppShell` | Pattern 7, Pitfall 1 | Low — the Outlet/children pattern is identical in both modes. Verify via smoke test: log in + navigate all 10 routes. |
| A6 | The existing `queryClient.invalidateQueries({ queryKey: ['invoices'] })` is sufficient cache invalidation after a draft create/update/delete | Example 2, Example 5 | Low — matches existing code pattern. Invalidating 'invoices' will refetch the list including the Entwürfe tab (Phase 3). |
| A7 | `getValues()` from react-hook-form returns the current form snapshot reliably in event handlers (not render) | Example 3 | Low — documented behaviour; project uses it elsewhere (no specific counter-example found in grep). |
| A8 | The DELETE endpoint is not in Phase 1 and must be added in this phase | Pitfall 6, Example 6 | **High confidence** — [VERIFIED: grep over `backend/src/modules/invoices/invoices.routes.ts` shows only POST/PATCH for `/draft`, no DELETE]. |
| A9 | CONTEXT D-06 "use `useBlocker`" assumes the router already supports it | Summary | **Medium** — the CONTEXT author may not have known the project uses `BrowserRouter`. Surface to user: either migrate router or switch to fallback. |

## Open Questions

1. **How does the user want to resolve the `useBlocker` / `BrowserRouter` incompatibility?**
   - What we know: `useBlocker` requires data router; current app uses declarative `BrowserRouter`.
   - What's unclear: Whether user prefers router migration (Option 1), private-API workaround (Option 2), or dropping navigation-save (Option 3).
   - Recommendation: Surface as the first planning question. Default to Option 1 (migration). A ~40-line refactor of `App.tsx` is the cleanest path.

2. **Does the Abbrechen button route through `onOpenChange` or call `onClose` directly?**
   - What we know: Current code calls `onClose()` directly (verified).
   - What's unclear: Whether the planner should unify both paths through a single save handler or leave them divergent.
   - Recommendation: Unify. Make Abbrechen invoke the same `handleCloseRequested` as `onOpenChange(false)`. Simpler, fewer bugs.

3. **What form-data shape should `performDraftSave` send?**
   - What we know: Phase 1 accepts partial payloads with all fields optional.
   - What's unclear: Whether to send ALL form fields (even empty strings) or only touched fields. Sending all works; the backend overwrites only supplied fields (PATCH semantics). Sending only touched fields is slightly more efficient but requires plumbing react-hook-form's dirty-fields API.
   - Recommendation: Send all fields — simpler, no-op semantically, matches how existing `updateInvoiceMutation` works.

4. **Should the Phase 2 plan also explicitly expose a "download drafts" button or is that pure Phase 3?**
   - RESOLVED: Pure Phase 3 (DRAFT-05 through DRAFT-08 are Phase 3/4 scope). Phase 2 creates the drafts; Phase 3 makes them viewable/clickable.

5. **How do we signal save state to the user in Phase 2?**
   - What we know: UI-SPEC explicitly forbids a "Wird gespeichert..." spinner in this phase (that's Phase 4).
   - What's unclear: Whether the failure toast suffices for the "Save failure shows indication" success criterion (Phase 2 success criterion #4).
   - Recommendation: The destructive toast + unchanged visible form (the user's data hasn't been wiped) satisfies the criterion. No additional affordance.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React Router DOM | `useBlocker` | ✓ | 6.25.1 | — (but see below) |
| React Router data-router APIs | `useBlocker`, `createBrowserRouter`, `RouterProvider` | ✓ (library version supports them) | 6.25.1 | `UNSAFE_NavigationContext` workaround (risky) |
| `@tanstack/react-query` `useMutation` | `createDraftMutation` etc. | ✓ | 5.51.11 | — |
| `@radix-ui/react-dialog` `onOpenChange` | Close interception | ✓ | 1.1.2 | — |
| `@/hooks/use-toast` | Save-failure notification | ✓ | local | — |
| Backend `POST /invoices/draft` | Create draft | ✓ | Phase 1 | — |
| Backend `PATCH /invoices/draft/:id` | Update draft | ✓ | Phase 1 | — |
| Backend `DELETE /invoices/draft/:id` | Finalize cleanup | ✗ | — | **Must be added this phase** |
| Node.js 24 | Backend runtime | ✓ | v24 | — |
| Docker | Local dev | Assumed ✓ | — | `npm run dev --workspace=frontend` directly |

**Missing dependencies with no fallback:**
- Backend `DELETE /invoices/draft/:id` — blocks D-07/D-08 flow. Planner must add this endpoint + service method. ~30 LOC.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None detected** — no test files, no test runner in any workspace's `package.json` |
| Config file | none — same baseline as Phase 1 |
| Quick run command | `npm run build --workspace=frontend` (TypeScript typecheck + Vite build) |
| Full suite command | `npm run build` from repo root (typechecks all workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAFT-03 | Dialog close (X button) with customer selected saves draft | manual + browser devtools | Open dialog, select customer, fill fields, click X → observe POST `/draft` 201 in Network tab | ❌ manual |
| DRAFT-03 | Dialog close (backdrop click) saves draft | manual | Same as above, click outside dialog | ❌ manual |
| DRAFT-03 | Dialog close (Abbrechen) saves draft | manual | Same as above, click Abbrechen | ❌ manual |
| DRAFT-03 | Close without customer selected skips save | manual | Open dialog, close at step 1 → no POST should fire | ❌ manual |
| DRAFT-04 | Navigating to sidebar item with dialog open saves draft | manual | Open dialog, fill, click "Kunden" in sidebar → observe POST + navigation | ❌ manual |
| DRAFT-05 | Draft receives `DRAFT-xxxx` number | manual + DB query | Inspect response JSON `invoiceNumber` matches `^DRAFT-[a-f0-9]{8}$` | ❌ manual |
| DRAFT-06 | Save gated on `selectedCustomer !== null` | manual | Same as "close without customer" above | ❌ manual |
| Success Criterion 1 | Closing mid-fill silently saves | manual | Visual — no toast should appear on success | ❌ manual |
| Success Criterion 2 | Navigate-away triggers save | manual | Same as DRAFT-04 above | ❌ manual |
| Success Criterion 3 | Rapid typing doesn't fire per-keystroke | manual | Type fast, watch Network tab — NO requests should fire during typing; only on close/nav | ❌ manual |
| Success Criterion 4 | Save failure shows indication | manual + backend manipulation | Temporarily kill backend, close dialog → destructive toast should appear | ❌ manual |
| TypeScript compiles | All new frontend code passes `tsc --strict` | automated | `npm run build --workspace=frontend` | ✓ |
| TypeScript compiles (backend) | DELETE endpoint compiles | automated | `npm run build --workspace=backend` | ✓ |
| Router migration doesn't break existing routes | All 10 routes still work | manual | Log in, visit every route in sidebar | ❌ manual |
| Blocker doesn't interfere with logout redirect | 401 → /login still redirects | manual | Let token expire, trigger request → should redirect without hang | ❌ manual |

### Sampling Rate
- **Per task commit:** `npm run build` at repo root (typecheck frontend + backend)
- **Per wave merge:** Full manual smoke: open dialog, test every close path (X, backdrop, Abbrechen, nav-away), verify draft in Entwürfe tab (note: drafts visible only in "Alle" tab in Phase 2 — Phase 3 adds the Entwürfe tab filter), finalize a draft end-to-end (POST + DELETE observable in Network)
- **Phase gate:** All 4 success criteria manually verified; regression check of all 10 routes after router migration

### Wave 0 Gaps
- [ ] No automated test framework exists project-wide. Continue the Phase 1 pattern: manual + typecheck baseline. Adding vitest/@testing-library to frontend is a worthy standalone task but out of scope for Phase 2 per CLAUDE.md "no new dependencies." Surface as deferred.
- [ ] A scripted browser test (Playwright etc.) would cover DRAFT-03 and DRAFT-04 cleanly. Not in scope.
- [ ] If user wants automated coverage without adding deps: Node's built-in `node:test` could cover service-layer DELETE logic, but won't cover the React routing migration.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `apiClient` axios interceptor attaches Bearer JWT — no change needed |
| V3 Session Management | partial | Access token in memory, refresh rotation already implemented — unchanged by this phase |
| V4 Access Control | yes | Backend `requireRole('owner','admin','reception')` on all `/draft` routes (added in this phase for DELETE) |
| V5 Input Validation | yes | Backend Zod schema `draftInvoiceSchema` validates payload (Phase 1 existing); frontend sends well-typed payload via TypeScript |
| V6 Cryptography | no | No new crypto operations introduced |
| V7 Error Handling | yes | Destructive toast on save failure — no stack traces or internal state leaked to UI |
| V8 Data Protection | yes | RLS `app.current_tenant_id` GUC enforces tenant isolation on draft delete too — defence in depth via existing `WHERE tenant_id = $1` |
| V9 Communication | yes | HTTPS via existing nginx termination in production; dev uses local http proxy |
| V13 API & Web Service | yes | REST: `DELETE /draft/:id` returns 204 on success, 404 on missing, 400 on non-draft; Bearer auth header |

### Known Threat Patterns for React + React Router + Fastify stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant draft deletion (user deletes another tenant's draft by guessing UUID) | Information Disclosure / Tampering | RLS + service-level `WHERE tenant_id = $1` — 404 on cross-tenant attempt |
| Technician deletes someone's draft | Elevation of Privilege | `requireRole('owner','admin','reception')` on DELETE route |
| Draft enumeration via timing | Information Disclosure | Uniform 404 response for "not found" and "found in other tenant" already via existing service pattern |
| Stale JWT used for auto-save | Spoofing | Existing 401 → refresh → retry interceptor handles this transparently |
| CSRF via auto-save | Tampering | JWT in `Authorization` header (not cookies) eliminates classical CSRF |
| Mass assignment via draft payload (e.g., setting `tenantId`) | Tampering | Zod schema does not include `tenantId`, `status`, `invoiceNumber` in input — service hardcodes these |
| Client-side `beforeunload` data exfiltration | N/A | CONTEXT D-02 explicitly rejects `beforeunload` — no `sendBeacon` code path exists to exploit |

**No new security surface introduced** — the phase adds one DELETE endpoint with the same RLS + role-auth pattern as every other route.

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Compliance Plan |
|------------|--------|-----------------|
| **Tech stack:** Existing Fastify + Drizzle + React + TanStack Query — no new dependencies | CLAUDE.md > Constraints | Frontend: uses only already-installed libs. Backend: uses only already-installed libs. **No `package.json` changes.** |
| **Schema:** No migrations needed — `draft` status and `quote` type already in DB schema | CLAUDE.md > Constraints | No migrations in this phase. Phase 1 already handled the nullable-column migration. |
| Named exports on components | CLAUDE.md > Frontend Component Pattern | Existing — `InvoiceDialog` already uses named export. |
| Use TanStack Query for server state | CLAUDE.md > Frontend Component Pattern | `createDraftMutation`, `updateDraftMutation` follow pattern. |
| API modules use kebab-case `.api.ts` | CLAUDE.md > File Naming | Extending existing `invoices.api.ts`. |
| No local state for server data — all via TanStack Query | CLAUDE.md > Frontend Component Pattern | `draftIdRef` is not server data; it's session-local coordination state. Ref is appropriate (D-09). |
| `errors.*` factory for 404s | CLAUDE.md > Backend Module Pattern | Backend `deleteDraft` throws `errors.notFound('Draft')`. |
| Strict TypeScript | CLAUDE.md > TypeScript | All new code typed end-to-end. |
| GSD workflow enforcement | CLAUDE.md > GSD Workflow | This research is part of `/gsd-plan-phase` flow. |

## Sources

### Primary (HIGH confidence)
- `frontend/src/App.tsx:34` — verified `BrowserRouter` usage; confirms blocker incompatibility
- `frontend/src/pages/invoices/InvoiceDialog.tsx` (full) — existing dialog structure, `onOpenChange` wiring, mutation patterns
- `frontend/src/pages/invoices/InvoicesPage.tsx` (full) — dialog open/close state ownership
- `frontend/src/api/invoices.api.ts` (full) — existing API shape
- `frontend/src/hooks/use-toast.ts` — toast implementation
- `frontend/package.json` — all versions verified (React Router 6.25.1, TanStack 5.51.11, Radix Dialog 1.1.2)
- `backend/src/modules/invoices/invoices.routes.ts` — verified NO DELETE endpoint exists; verified `/draft` POST + PATCH shape
- `backend/src/modules/invoices/invoices.service.ts` — existing service pattern for new `deleteDraft` method
- `backend/src/db/schema/invoices.ts` — verified `invoice_items` cascade-delete on invoice delete (`onDelete: 'cascade'`)
- `.planning/phases/02-auto-save-core/02-CONTEXT.md` — locked decisions
- `.planning/phases/02-auto-save-core/02-UI-SPEC.md` — UI contract for toast copy + no-spinner rule
- `.planning/phases/01-backend-draft-api/01-RESEARCH.md` — Phase 1 backend shape (referenced for payload contract)
- `.planning/REQUIREMENTS.md` — DRAFT-01 through DRAFT-10 definitions
- `CLAUDE.md` — project constraints
- React Router official docs: https://reactrouter.com/api/hooks/useBlocker — confirms declarative BrowserRouter not supported
- React Router official decision record: https://github.com/remix-run/react-router/blob/main/decisions/0001-use-blocker.md — confirms data-router-only scope
- React Router migration guide: https://reactrouter.com/en/main/upgrading/v6-data — `createBrowserRouter` migration steps
- React Router how-to: https://reactrouter.com/how-to/navigation-blocking — save-before-navigation pattern

### Secondary (MEDIUM confidence)
- GitHub discussion https://github.com/remix-run/react-router/discussions/12747 — async-save-with-useBlocker pattern (rjgotten's answer) — used as corroboration for Pattern 2
- TanStack Query v5 mutation docs (via WebSearch) — `mutateAsync` error handling pattern

### Tertiary (LOW confidence)
- None — every navigation-blocking claim verified against official React Router docs + GitHub issues.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all libraries verified at versions in `frontend/package.json` and `backend/package.json`
- Architecture patterns: **HIGH** — extending existing mutation + dialog + ref patterns already proven in the codebase
- `useBlocker` / `BrowserRouter` incompatibility: **HIGH** — verified against React Router official docs AND the source code's own `App.tsx`
- Finalize flow (D-07/D-08): **HIGH** — direct mapping to existing `createInvoiceMutation` path
- Backend DELETE endpoint gap: **HIGH** — verified by grep over Phase 1 routes file
- Pitfalls 7 (race condition) and 8 (logout interaction): **MEDIUM** — edge cases that need smoke tests to confirm behaviour under load

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable codebase, no fast-moving deps; React Router v6 is in maintenance mode with stable `useBlocker` API)
