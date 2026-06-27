---
target: frontend/src/pages/orders/OrderDetailSheet.tsx
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T13-44-02Z
slug: frontend-src-pages-orders-orderdetailsheet-tsx
---
# Critique (re-run) — OrderDetailSheet.tsx

## Design Health Score: 35/40 (Good, top of band) — up from 32

1 Visibility: 3 — header skeleton + toasts; body loading still bare text
2 Match Real World: 4
3 User Control & Freedom: 4 — Radix dialog, delete confirmed, reversible transitions
4 Consistency: 4 — tabs now real Radix tablist; residual native-select/toast
5 Error Prevention: 4 — delete confirm + convert double-add guard + invoiced-lock
6 Recognition vs Recall: 4
7 Flexibility & Efficiency: 3 — keyboard tab nav now; no bulk
8 Aesthetic & Minimalist: 4 — wider 820px sheet, items table room, tabular-nums
9 Error Recovery: 3 — toast + server message
10 Help & Documentation: 2 — minimal

## Anti-Patterns Verdict
LLM: Not slop. Earlier a11y/integrity gaps closed — tablist, delete+convert guards, invoiced no longer mutable.
Detector: detect.mjs [] exit 0. Overlay: unavailable.

## What's Working
1. Tabs now a real tablist — roving tabindex, arrow keys, aria-selected, focus ring.
2. Integrity consistent with form — convert disables after use + when invoiced; delete confirms.
3. Wider 820px drawer — 5-col items table breathes.

## Remaining (all P3 — no P1/P2)
- Body loading bare text vs header skeleton — skeleton the body too.
- Add-time-entry validation via destructive toasts vs inline field errors.
- Native select for Mitarbeiter vs Radix; StaffDot hardcoded #94a3b8 fallback → token.
- status label/variant + ALLOWED_TRANSITIONS duplicated across list/sheet/form/dashboard — extract.

## Persona Red Flags
Sam: resolved — tablist + real delete dialog; nit: toast-only add-entry validation.
Riley/Stefan: double-convert + invoiced-mutation traps closed; nothing risks money/data here.
