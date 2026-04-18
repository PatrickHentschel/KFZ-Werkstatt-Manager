---
phase: 1
slug: backend-draft-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed project-wide |
| **Config file** | none |
| **Quick run command** | `cd backend && npx tsc --noEmit` |
| **Full suite command** | `cd backend && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx tsc --noEmit`
- **After every plan wave:** Run `cd backend && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full typecheck must pass + manual curl smoke tests
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DRAFT-01 | — | N/A | typecheck | `cd backend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | DRAFT-02 | — | N/A | typecheck | `cd backend && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (TypeScript compiler available, no new test framework needed for this phase).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| POST /draft creates draft with DRAFT-xxxx placeholder | DRAFT-01 | No test framework | `curl -X POST /api/v1/invoices/draft -H "Authorization: Bearer <token>" -d '{}'` → 201 with invoiceNumber starting DRAFT- |
| PATCH /draft/:id updates without creating duplicate | DRAFT-01 | No test framework | Call POST, capture id, call PATCH with same id → same invoice returned, no new row |
| Partial payload (no customerId) accepted | DRAFT-01 | No test framework | POST with empty body → 201 (not 400) |
| technician role rejected | DRAFT-01 | No test framework | POST with technician JWT → 403 |
| Migration runs cleanly | DRAFT-02 | No test framework | `cd backend && npm run db:migrate` → no errors, customer_id and issue_date nullable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
