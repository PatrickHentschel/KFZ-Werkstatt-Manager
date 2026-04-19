---
status: partial
phase: 01-backend-draft-api
source: [01-VERIFICATION.md]
started: 2026-04-19T10:30:00Z
updated: 2026-04-19T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live DB nullability confirmed
expected: `information_schema.columns` shows `customer_id.is_nullable=YES` and `issue_date.is_nullable=YES` for the `invoices` table; `tenant_id` and `invoice_number` remain `NO`
result: [pending]

### 2. POST /draft smoke test
expected: `POST /api/v1/invoices/draft` with empty body `{}` → HTTP 201 with `"status":"draft"` and `"invoiceNumber"` matching `^DRAFT-[a-f0-9]{8}$`
result: [pending]

### 3. PATCH /draft/:id smoke test
expected: `PATCH /api/v1/invoices/draft/:id` with `{"notes":"hello"}` → HTTP 200, same id/invoiceNumber, notes updated, no new row created
result: [pending]

### 4. Role enforcement — technician blocked
expected: `POST /draft` with technician token → HTTP 403
result: [pending]

### 5. Tenant counter unchanged
expected: `tenants.invoice_counter` value identical before and after creating 3 drafts (drafts do not consume sequential counter)
result: [pending]

### 6. PATCH non-existent id returns 404
expected: `PATCH /draft/00000000-0000-0000-0000-000000000000` → HTTP 404
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
