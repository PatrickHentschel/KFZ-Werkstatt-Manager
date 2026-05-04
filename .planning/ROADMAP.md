# Roadmap: Invoice Draft Auto-Save

## Overview

Milestone adds draft auto-save to WerkstattClone invoice flow. User starts filling invoice, closes dialog or navigates away — work saved as draft. Drafts tab lets them find, resume, delete in-progress invoices. Backend gains upsert endpoint and draft-safe invoice number generation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between surrounding integers in numeric order.

- [ ] **Phase 1: Backend Draft API** - Upsert endpoint and draft invoice number generation
- [ ] **Phase 2: Auto-Save Core** - Auto-save on dialog close and route navigation
- [ ] **Phase 3: Drafts Tab** - List, resume, and delete draft invoices
- [ ] **Phase 4: UX Feedback** - Save indicators, error states, and empty states

## Phase Details

### Phase 1: Backend Draft API
**Goal**: Backend persists partial invoice data and assigns placeholder draft numbers without gaps in final invoice sequence
**Depends on**: Nothing (first phase)
**Requirements**: DRAFT-01, DRAFT-02
**Success Criteria** (what must be TRUE):
  1. Partial invoice payload (missing required final fields) saves via upsert without 400 error
  2. Draft invoices get placeholder identifier (e.g., DRAFT-XXXX) — not permanent invoice number
  3. Second upsert call for same draft updates it, not duplicates
  4. Endpoint callable from frontend via standard fetch/axios, returns draft id
**Plans**: 2 plans
- [x] 01-01-PLAN.md — Schema migration: drop NOT NULL on `invoices.customer_id` and `invoices.issue_date` (generate + apply Drizzle migration)
- [x] 01-02-PLAN.md — Add `createDraft`/`updateDraft` to `InvoicesService` and `POST`/`PATCH /draft` routes with role enforcement

### Phase 2: Auto-Save Core
**Goal**: Users never lose in-progress invoice work — closing dialog or navigating away auto-saves draft
**Depends on**: Phase 1
**Requirements**: DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06
**Success Criteria** (what must be TRUE):
  1. Closing invoice dialog mid-fill silently saves draft, discards nothing
  2. Navigating away while dialog open triggers draft save before navigation completes
  3. Rapid typing doesn't fire network request per keystroke — saves debounced
  4. Save failure shows indication — no silent data loss
**Plans**: 4 plans
- [ ] 02-01-PLAN.md — Backend DELETE /draft/:id endpoint + frontend invoicesApi draft methods (createDraft/updateDraft/deleteDraft)
- [ ] 02-02-PLAN.md — Migrate App.tsx to createBrowserRouter + RouterProvider (unblocks useBlocker)
- [ ] 02-03-PLAN.md — Close-time draft save in InvoiceDialog + finalize cleanup + 'Alle' tab excludes drafts
- [ ] 02-04-PLAN.md — Navigation-away draft save via useBlocker in InvoiceDialog
**UI hint**: yes

### Phase 3: Drafts Tab
**Goal**: Users find and continue any auto-saved draft from dedicated Drafts tab
**Depends on**: Phase 2
**Requirements**: DRAFT-07, DRAFT-08, DRAFT-09
**Success Criteria** (what must be TRUE):
  1. Drafts tab visible on Invoices page, lists all draft invoices
  2. Clicking draft opens invoice dialog pre-populated with saved data
  3. Draft deletable from tab, removed permanently
  4. Empty state shown when no drafts exist
**Plans**: TBD
**UI hint**: yes

### Phase 4: UX Feedback
**Goal**: Users always know draft save state — saving, saved, or failed
**Depends on**: Phase 3
**Requirements**: DRAFT-10
**Success Criteria** (what must be TRUE):
  1. Save in-flight shows visible indicator (spinner or "Saving..." label) in dialog
  2. Successful save updates indicator to confirmation state (e.g., "Saved" + timestamp or checkmark)
  3. Failed save shows error state, not "Saved"
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Draft API | 0/2 | Not started | - |
| 2. Auto-Save Core | 0/? | Not started | - |
| 3. Drafts Tab | 0/? | Not started | - |
| 4. UX Feedback | 0/? | Not started | - |