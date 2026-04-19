# WerkstattClone

## What This Is

Multi-tenant workshop management app for automotive repair shops. Manages customers, vehicles, work orders, invoices, appointments, staff, parts inventory. Fastify + Drizzle + PostgreSQL backend, React + Vite frontend.

## Core Value

Workshop owners manage entire operation — customer intake to paid invoice — without losing work in progress.

## Requirements

### Validated

- ✓ Customer management (CRUD, search) — existing
- ✓ Vehicle management with customer association — existing
- ✓ Work order management with items (labor, parts) — existing
- ✓ Invoice generation from orders with PDF export — existing
- ✓ Appointment/calendar management with Google Calendar sync — existing
- ✓ Staff management with hourly/AW/cost rates — existing
- ✓ Parts inventory with low-stock tracking — existing
- ✓ Dashboard with key metrics — existing
- ✓ Reports: revenue, staff hours, top customers, revenue breakdown — existing
- ✓ Multi-tenant with per-request PostgreSQL RLS isolation — existing
- ✓ JWT auth with refresh token rotation — existing
- ✓ Stripe payment integration (optional/demo mode) — existing

### Active

- [ ] **DRAFT-01**: Invoice dialog auto-saves to DB as `draft` when user exits (dialog close, page navigation, any dialog leave event)
- [ ] **DRAFT-02**: Invoices list has "Drafts" tab/filter showing only `status = draft` invoices
- [ ] **DRAFT-03**: Drafts tab separated from active invoices (sent/paid/cancelled) in UI
- [ ] **DRAFT-04**: User can resume editing draft invoice from Drafts tab

### Out of Scope

- Separate "Angebote" module — handled via `invoice.type = 'quote'` on existing invoice schema
- Local-only draft persistence (localStorage) — DB-persisted drafts chosen for reliability and shareability

## Current State

Phase 1 complete — backend draft API delivered. `POST /api/v1/invoices/draft` and `PATCH /api/v1/invoices/draft/:id` live. Schema nullable. Frontend (Phase 2) is next.

## Context

Brownfield codebase. Invoice schema already has `status` enum with `draft` as default and `type` enum with `invoice`/`quote`/`credit_note`. DB layer requires no changes.

Key files:
- `frontend/src/pages/invoices/InvoiceDialog.tsx` — dialog to modify
- `frontend/src/pages/invoices/InvoicesPage.tsx` — list to add Drafts tab
- `frontend/src/api/invoices.api.ts` — API client
- `backend/src/modules/invoices/invoices.service.ts` — service layer (createDraft, updateDraft added)
- `backend/src/db/schema/invoices.ts` — schema (customerId, issueDate now nullable)

## Constraints

- **Tech stack**: Existing Fastify + Drizzle + React + TanStack Query — no new dependencies
- **Schema**: No migrations needed — `draft` status and `quote` type already in DB schema

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DB-persisted drafts (not localStorage) | Survives refresh, accessible from other devices, shareable | — Pending |
| Reuse existing invoice schema | `status = draft` already exists, no migration needed | ✓ Good |
| Drafts in separate tab (not mixed list) | Cleaner UX, drafts don't clutter active invoice workflow | — Pending |
| DRAFT-xxxxxxxx numbering (not sequential) | Drafts must not consume tenant invoice counter | ✓ Validated in Phase 1 |

---
*Last updated: 2026-04-19 after Phase 1 complete*