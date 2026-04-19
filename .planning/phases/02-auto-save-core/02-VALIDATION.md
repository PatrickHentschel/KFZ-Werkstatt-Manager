---
phase: 2
slug: auto-save-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed (per CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `cd frontend && npx tsc --noEmit` |
| **Full suite command** | `cd frontend && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx tsc --noEmit`
- **After every plan wave:** Run `cd frontend && npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | DRAFT-03 | — | N/A | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | DRAFT-03 | — | N/A | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 1 | DRAFT-04 | — | N/A | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-03-01 | 03 | 2 | DRAFT-05 | — | N/A | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-04-01 | 04 | 2 | DRAFT-06 | — | N/A | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed — TypeScript type-check serves as the automated gate for all tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dialog close triggers silent draft save | DRAFT-03 | No test framework — requires browser interaction | Open invoice dialog, fill customer field, close via X/backdrop/Abbrechen; check network tab for POST /draft |
| Navigation away triggers draft save | DRAFT-04 | Requires router state + browser nav | Open dialog, fill customer, click sidebar link; confirm navigation proceeds and draft saved |
| Debounce: no per-keystroke requests | DRAFT-05 | Requires browser network observation | Type rapidly in form fields; confirm single request per 300ms window, not per keystroke |
| Save failure shows toast | DRAFT-06 | Requires mock server error | Force API error (network tab block), trigger save; confirm destructive toast appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
