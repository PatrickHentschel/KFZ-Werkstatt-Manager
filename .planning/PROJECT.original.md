# WerkstattClone

## What This Is

Multi-tenant workshop management app for automotive repair shops. Manages customers, vehicles, work orders, invoices, appointments, staff, and parts inventory. Built with Fastify + Drizzle + PostgreSQL backend and React + Vite frontend.

## Core Value

Workshop owners can manage their entire operation — from customer intake to paid invoice — without losing work in progress.

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
- [ ] **DRAFT-03**: Drafts tab separated from active invoices (sent/paid/cancelled) in the UI
- [ ] **DRAFT-04**: User can resume editing a draft invoice from the Drafts tab

### Out of Scope

- Separate "Angebote" module — handled via `invoice.type = 'quote'` on existing invoice schema
- Local-only draft persistence (localStorage) — DB-persisted drafts chosen for reliability and shareability

## Context

Brownfield codebase. Invoice schema already has `status` enum with `draft` as default value and `type` enum with `invoice`/`quote`/`credit_note`. DB layer requires no changes.

Key files:
- `frontend/src/pages/invoices/InvoiceDialog.tsx` — dialog to modify
- `frontend/src/pages/invoices/InvoicesPage.tsx` — list to add Drafts tab
- `frontend/src/api/invoices.api.ts` — API client
- `backend/src/modules/invoices/invoices.service.ts` — service layer
- `backend/src/db/schema/invoices.ts` — schema (draft status already exists)

## Constraints

- **Tech stack**: Existing Fastify + Drizzle + React + TanStack Query — no new dependencies
- **Schema**: No migrations needed — `draft` status and `quote` type already in DB schema

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DB-persisted drafts (not localStorage) | Survives refresh, accessible from other devices, shareable | — Pending |
| Reuse existing invoice schema | `status = draft` already exists, no migration needed | ✓ Good |
| Drafts in separate tab (not mixed list) | Cleaner UX, drafts don't clutter active invoice workflow | — Pending |

---
*Last updated: 2026-04-17 after initialization*
