---
target: frontend/src/pages/orders/OrderDetailSheet.tsx
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T05-39-20Z
slug: frontend-src-pages-orders-orderdetailsheet-tsx
---
# Critique — OrderDetailSheet.tsx

## Design Health Score: 32/40 (Good)

1 Visibility of System Status: 3 — status badge, toasts, header skeleton, loading/not-found/empty; body loading bare text
2 Match Real World: 4 — domain German, de-DE money/dates, AW, mono plates
3 User Control & Freedom: 4 — Radix dialog (Esc/overlay/X), delete confirmed, transitions reversible
4 Consistency: 3 — tabs not tablist; native select; toast vs inline validation; bypasses form's invoiced-lock
5 Error Prevention: 3 — delete confirmed; status→invoiced + item-convert on invoiced unguarded; Übernehmen double-add
6 Recognition vs Recall: 4 — visible, transition options shown, entries labeled
7 Flexibility & Efficiency: 3 — tabs, inline status switch, time→labor convert, quick add; no keyboard tab nav
8 Aesthetic & Minimalist: 3 — clean, dense, tabular-nums; overview three stacked bordered cards (ok for detail panel)
9 Error Recovery: 3 — mutation errors → destructive toast w/ server msg + fallback
10 Help & Documentation: 2 — minimal; a few title hints, less than the form

## Anti-Patterns Verdict
LLM: Not slop. Domain detail sheet — backend-mirrored transition graph, time→labor convert, net/brutto. Radix sheet correct.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Proper modal mechanics — Radix Dialog: focus-trap, Esc, overlay close, aria-describedby handled.
2. Status switcher — renders only backend-allowed transitions; can't pick invalid move.
3. Time→labor conversion w/ AW/hourly math; delete now confirmed.

## Priority Issues
[P2] Tabs not a real tablist — <button onClick>, no role/aria-selected/aria-controls, no arrow-key nav. SR/keyboard excluded. Fix: Radix Tabs or ARIA+keys. -> harden/adapt
[P2] Sheet bypasses invoiced-lock — on invoiced order, status switcher + "Übernehmen" still mutate items/status, desyncing issued invoice; form locks this, sheet doesn't. Fix: disable risky transitions + convert when invoiced. -> harden
[P2] "Übernehmen" double-adds — clicking twice appends same entry as two labor positions, no guard/feedback. Fix: mark converted (disable + "Übernommen") or confirm. -> harden/clarify
[P3] Body loading bare text vs header skeleton; add-form toast-validation vs inline; native select; StaffDot hardcoded #94a3b8 fallback.

## Persona Red Flags
Sam: tabs no tablist semantics/keyboard arrows; dialog mechanics fine.
Riley: double-click Übernehmen = duplicate billable lines; invoiced order still mutable here.
Alex: efficient switcher/convert; no keyboard tab nav.
Stefan: quick status/time smooth; convert-twice trap during busy intake.

## Minor
- status label/variant + ALLOWED_TRANSITIONS duplicated from list/form — extract.
- add-time-entry toast-validation is the odd one out vs inline zod.
