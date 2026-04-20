---
plan: 02-04
phase: 02-auto-save-core
status: complete
completed: 2026-04-20
---

## Summary

Wired `useBlocker` from `react-router-dom` into `InvoiceDialog` to intercept in-app navigation and silently save a draft before proceeding. Human smoke test approved (all 5 scenarios).

## What Was Built

- `import { useBlocker } from 'react-router-dom'` added to InvoiceDialog
- `const blocker = useBlocker(...)` with predicate: `open && !!selectedCustomer && currentLocation.pathname !== nextLocation.pathname && nextLocation.pathname !== '/login'`
- `useEffect` watching `blocker.state`: fires `void performDraftSave()` (fire-and-forget) then `blocker.proceed?.()` immediately when state is `'blocked'`

## Human Smoke Test Results

All 5 scenarios passed (approved by developer):
- **A**: POST /draft fires on sidebar nav with customer selected; draft appears in Entwurf tab; NOT in Alle tab ✓
- **B**: No POST when no customer selected ✓
- **C**: Closed dialog does not block navigation ✓
- **D**: Blocker re-arms correctly across multiple navigations ✓
- **E**: Auth-driven /login redirect bypasses blocker without hang ✓

## Grep Verification

- `useBlocker` count: 2 (import + hook call) ✓
- `performDraftSave` count: 3 (definition + handleClose + blocker effect) ✓
- `beforeunload` count: 0 ✓
- `nextLocation.pathname !== '/login'` guard: present ✓
- `currentLocation.pathname !== nextLocation.pathname` guard: present ✓

## Phase 2 Success Criteria Status

- SC-1 (close-time save): ✓ Plan 03
- SC-2 (nav-away save): ✓ This plan
- SC-3 (finalize cleanup): ✓ Plan 03
- SC-4 (Alle tab excludes drafts): ✓ Plan 03

**Phase 4 note:** The failure toast for nav-away save may not render before navigation completes — accepted by UI-SPEC for Phase 2; Phase 4 will replace with a reliable save indicator.

## Deviations

None. Plan executed exactly as specified.

## Self-Check: PASSED
