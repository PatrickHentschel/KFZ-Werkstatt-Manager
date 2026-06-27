---
target: frontend/src/pages/orders/OrderFormPage.tsx
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T05-27-49Z
slug: frontend-src-pages-orders-orderformpage-tsx
---
# Critique — OrderFormPage.tsx (create + edit)

## Design Health Score: 36/40 (Excellent)

1 Visibility of System Status: 4 — edit skeleton, sticky busy footer, inline errors, toasts
2 Match Real World: 4 — domain German, de-DE money, AW/Skonto/§19
3 User Control & Freedom: 4 — dirty-guard, cancel/back, read-only customer/vehicle, invoiced lock
4 Consistency: 3 — native select vs Radix; Label not associated with inputs; part-picker rows mouse-only
5 Error Prevention: 4 — zod + dirty-guard + read-only + invoiced fieldset-lock + partial-save message
6 Recognition vs Recall: 4 — part picker, echoed selection, EK shown, staff rates in options
7 Flexibility & Efficiency: 3 — auto-fill/staff-rate/discounts; picker keyboard-inaccessible, no shortcuts
8 Aesthetic & Minimalist: 3 — items de-nested; long monotone 5-section stack; discount row on every item
9 Error Recovery: 3 — partial-save named, server msg surfaced; field-level server errors not mapped
10 Help & Documentation: 4 — excellent inline help/descriptions, invoiced banner

## Anti-Patterns Verdict
LLM: Not slop. Hand-built domain form; de-nesting + invoiced lock + loading skeleton lifted it to solid. Remaining = a11y plumbing + layout monotony.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Error-prevention trifecta — unsaved-guard + read-only customer/vehicle + invoiced fieldset lock.
2. Part picker + line-item intelligence — fill name/price/tax/EK, staff-rate apply, live totals, discounts.
3. Inline help that teaches — section descriptions, skonto note, invoiced banner explains why.

## Priority Issues (all P2/P3 — ship-grade)
[P2] Labels not associated — <Label> no htmlFor, inputs no id; SR announces unlabeled fields, label-click doesn't focus. Every field. Fix: id+htmlFor or wrap. -> harden/adapt
[P2] Part-search picker mouse-only — <tr onClick> adds part, Plus decorative; no keyboard path. Same gap fixed on list. Fix: real button/keyboard trigger. -> harden/adapt
[P2] Long monotone stack + discount-row-per-item — 5 identical sections, no rhythm/anchor; discount shown on every item by default. Fix: vary rhythm; progressive discount. -> layout/distill
[P3] max-h-[480px] on <tbody> does nothing (not scroll container); native select vs Radix; skonto card-in-card; mileageIn static placeholder in edit.

## Persona Red Flags
Sam: inputs lack associated labels; part picker not keyboard-operable.
Alex: efficient picker but no keyboard add, no shortcuts, long scroll.
Riley: many items → very long form; part-results max-height ineffective.
Stefan: guided flow clear; create thorough but long.

## Minor
- Per-item Mitarbeiter select uncontrolled (defaultValue="") applies rate only.
- Status label/variant maps duplicated across files.
