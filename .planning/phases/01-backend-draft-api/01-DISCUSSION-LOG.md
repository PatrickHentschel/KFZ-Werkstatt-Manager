# Phase 1: Backend Draft API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 01-backend-draft-api
**Areas discussed:** Endpoint design, Minimum payload, Authorization

---

## Endpoint Design

| Option | Description | Selected |
|--------|-------------|----------|
| New POST /draft + PATCH /draft/:id | Separate routes for create/update; clean separation from real invoices | ✓ |
| PUT /draft/:id? (pure upsert) | Single endpoint, no id = create, with id = update | |
| Extend existing POST / | Add `draft: true` flag to existing create endpoint | |

**User's choice:** New `POST /api/v1/invoices/draft` + `PATCH /api/v1/invoices/draft/:id`
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full invoice object | Returns all fields including id and invoiceNumber | ✓ |
| Just { id, invoiceNumber } | Minimal response for Phase 2 tracking | |

**User's choice:** Full invoice object
**Notes:** None

---

## Minimum Payload

| Option | Description | Selected |
|--------|-------------|----------|
| Truly minimal — only JWT tenant | No fields required, empty save allowed | ✓ |
| Customer required | At least customerId must be present | |
| Customer + at least one item | Meaningful draft minimum | |

**User's choice:** Truly minimal — only JWT tenant (no required fields beyond authentication)
**Notes:** Empty items array is valid

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — merge with existing data | PATCH only overwrites provided fields | ✓ |
| No — replace all fields | Caller must resend full state each time | |

**User's choice:** Merge (partial update semantics)
**Notes:** None

---

## Authorization

| Option | Description | Selected |
|--------|-------------|----------|
| All authenticated roles | owner, admin, technician, reception | |
| owner + admin only | Consistent with existing invoice creation | |
| owner + admin + reception | Exclude technicians only | ✓ |

**User's choice:** owner, admin, reception — technicians explicitly excluded
**Notes:** User confirmed: "owner, admin and reception shall be able to save drafts, no technicians"

---

## Claude's Discretion

- Draft number format (`DRAFT-` + 8-char UUID segment)
- Internal service method naming
- Whether to use single `draftsService` or extend existing `invoicesService` (follow existing pattern → extend)

## Deferred Ideas

None.
