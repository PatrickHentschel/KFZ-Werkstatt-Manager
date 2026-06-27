---
target: frontend/src/pages/parts/PartsPage.tsx
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T21-51-59Z
slug: frontend-src-pages-parts-partspage-tsx
---
# Critique — PartsPage.tsx (parts + vendors list)

## Design Health Score: 32/40 (Good)

1 Visibility: 3 — low-stock warning + toasts + pagination; bare-text loading
2 Match Real World: 4 — SKU/OEM, Bestand/Mindestbestand, Lieferant
3 User Control & Freedom: 3 — tabs/filter/pagination/delete-confirm; stock ±1 no undo (reversible)
4 Consistency: 3 — tabs not tablist; native confirm(); title not aria-label; no table overflow
5 Error Prevention: 3 — delete confirms; stock ±1 unconfirmed (low-stakes ok)
6 Recognition vs Recall: 4 — visible actions, low-stock visual, category badges
7 Flexibility & Efficiency: 4 — inline ±1 stock adjust + low-stock filter + URL-param tabs
8 Aesthetic & Minimalist: 3 — clean; busy stock cell (qty+Min+2 buttons)
9 Error Recovery: 3 — delete toast; adjustStockMutation has NO onError (silent fail)
10 Help & Documentation: 2 — minimal

## Anti-Patterns Verdict
LLM: Not slop. Inline ±1 stock correction, low-stock filter, URL-param tabs — thoughtful inventory affordances.
Detector: detect.mjs [] exit 0. Overlay: unavailable.

## What's Working
1. Inline ±1 stock adjust + live low-stock warning (warning token + icon).
2. Low-stock filter toggle with active state.
3. URL-param tabs — active tab survives nav to vendor form and back.

## Priority Issues (all P2/P3 — no P1)
[P2] List-polish gaps orders/invoices got, parts didn't: bare loading (no skeleton), empty states no CTA, native confirm() x2 vs AlertDialog, no overflow-x on 6-col table.
[P2] A11y: tabs not tablist; icon edit/delete/±1 buttons use title not aria-label.
[P3] adjustStockMutation no onError (silent fail); rapid ±1 unthrottled; vendors tab no pagination; delete may orphan referenced part (no warning).

## Persona Red Flags
Stefan: ±1 adjust + low-stock filter exactly right — fastest inventory surface.
Sam: non-tablist tabs; icon buttons title-only.
Riley: silent stock-adjust fail; rapid clicks queue writes; native confirm; delete may orphan.
