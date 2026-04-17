# Requirements: WerkstattClone — Invoice Draft Feature

**Defined:** 2026-04-17
**Core Value:** Workshop owners can manage their entire operation without losing work in progress.

## v1 Requirements

### Draft Auto-Save

- [ ] **DRAFT-01**: Invoice dialog auto-saves form data to DB as `status = draft` when user closes the dialog (X button or backdrop click)
- [ ] **DRAFT-02**: Invoice dialog auto-saves to DB as draft when user navigates away from the invoices page while dialog is open
- [ ] **DRAFT-03**: Draft invoice is created with a temporary invoice number placeholder (e.g. `DRAFT-{uuid-short}`) until finalized
- [ ] **DRAFT-04**: Auto-save only triggers if at least one required field has been filled (prevents empty drafts)

### Drafts Tab / UI

- [ ] **DRAFT-05**: Invoices list page has a "Entwürfe" (Drafts) tab/filter showing only `status = draft` invoices
- [ ] **DRAFT-06**: Active invoices tab excludes draft status (shows sent/paid/cancelled only)
- [ ] **DRAFT-07**: Draft invoices show a visual "Entwurf" badge in the list
- [ ] **DRAFT-08**: User can click a draft invoice in the Drafts tab to reopen the dialog and continue editing

### Finalize Draft

- [ ] **DRAFT-09**: User can explicitly finalize a draft (change status to `sent` or save without draft flag) from within the dialog
- [ ] **DRAFT-10**: Finalizing assigns the real sequential invoice number (replacing the draft placeholder)

## v2 Requirements

### Quote/Offer Type

- **QUOTE-01**: User can mark a draft invoice as type `quote` to send as an Angebot
- **QUOTE-02**: Accepted quote can be converted to invoice in one click

## Out of Scope

| Feature | Reason |
|---------|--------|
| localStorage draft persistence | DB-persisted chosen — survives refresh and device switching |
| Separate Angebote module | Handled via `invoice.type = 'quote'` on existing schema |
| Draft versioning / history | Overkill for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRAFT-01 | TBD | Pending |
| DRAFT-02 | TBD | Pending |
| DRAFT-03 | TBD | Pending |
| DRAFT-04 | TBD | Pending |
| DRAFT-05 | TBD | Pending |
| DRAFT-06 | TBD | Pending |
| DRAFT-07 | TBD | Pending |
| DRAFT-08 | TBD | Pending |
| DRAFT-09 | TBD | Pending |
| DRAFT-10 | TBD | Pending |
