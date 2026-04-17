# Roadmap: Invoice Draft Auto-Save

## Overview

This milestone adds draft auto-save to the WerkstattClone invoice flow. When a user starts filling out an invoice and closes the dialog or navigates away, their work is saved automatically as a draft. A dedicated Drafts tab lets them find, resume, and delete in-progress invoices. The backend gains a lightweight upsert endpoint and draft-safe invoice number generation to support partial saves.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Draft API** - Upsert endpoint and draft invoice number generation
- [ ] **Phase 2: Auto-Save Core** - Auto-save on dialog close and route navigation
- [ ] **Phase 3: Drafts Tab** - List, resume, and delete draft invoices
- [ ] **Phase 4: UX Feedback** - Save indicators, error states, and empty states

## Phase Details

### Phase 1: Backend Draft API
**Goal**: Backend can persist partial invoice data and assign placeholder draft numbers without creating gaps in the final invoice sequence
**Depends on**: Nothing (first phase)
**Requirements**: DRAFT-01, DRAFT-02
**Success Criteria** (what must be TRUE):
  1. A partial invoice payload (missing required final fields) can be saved via the upsert endpoint without a 400 error
  2. Draft invoices receive a placeholder identifier (e.g., DRAFT-XXXX) that is not a permanent invoice number
  3. Calling the upsert endpoint a second time for the same draft updates it rather than creating a duplicate
  4. The endpoint is callable from the frontend with a standard fetch/axios call and returns the draft id
**Plans**: TBD

### Phase 2: Auto-Save Core
**Goal**: Users never lose invoice work in progress — closing the dialog or navigating away automatically saves a draft
**Depends on**: Phase 1
**Requirements**: DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06
**Success Criteria** (what must be TRUE):
  1. Closing the invoice dialog mid-fill silently saves a draft and does not discard data
  2. Navigating to a different route while the invoice dialog is open triggers a draft save before the navigation completes
  3. Rapid typing in invoice fields does not fire a network request on every keystroke — saves are debounced
  4. If a save fails (network error), the user sees an indication that the save did not succeed rather than silent data loss
**Plans**: TBD
**UI hint**: yes

### Phase 3: Drafts Tab
**Goal**: Users can find and continue any previously auto-saved draft invoice from a dedicated Drafts tab
**Depends on**: Phase 2
**Requirements**: DRAFT-07, DRAFT-08, DRAFT-09
**Success Criteria** (what must be TRUE):
  1. A Drafts tab is visible on the Invoices page and shows all draft invoices in a list
  2. Clicking a draft opens the invoice dialog pre-populated with the saved data
  3. A draft can be deleted from the Drafts tab, removing it permanently
  4. The Drafts tab shows an empty state message when no drafts exist
**Plans**: TBD
**UI hint**: yes

### Phase 4: UX Feedback
**Goal**: Users always know the save state of their draft — whether it is saving, saved, or failed
**Depends on**: Phase 3
**Requirements**: DRAFT-10
**Success Criteria** (what must be TRUE):
  1. While a draft save is in flight, a visible indicator (spinner or "Saving..." label) appears in the invoice dialog
  2. After a successful save, the indicator updates to a confirmation state (e.g., "Saved" with a timestamp or checkmark)
  3. After a failed save, the indicator shows an error state and does not show "Saved"
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Draft API | 0/? | Not started | - |
| 2. Auto-Save Core | 0/? | Not started | - |
| 3. Drafts Tab | 0/? | Not started | - |
| 4. UX Feedback | 0/? | Not started | - |
