---
target: orders edit view
total_score: 32
p0_count: 0
p1_count: 1
timestamp: 2026-06-25T20-25-00Z
slug: frontend-src-pages-orders-orderformpage-edit-tsx
---
# Critique — Order Edit View (OrderFormPage.tsx, /orders/:id/edit)

## Design Health Score: 32/40 (Good)

1 Visibility of System Status: 3 — inline errors + sticky busy footer; edit loading blanks whole page
2 Match Real World: 4 — domain German, "nicht änderbar", de-DE money
3 User Control & Freedom: 3 — back/cancel/dirty-guard, customer+vehicle locked; no delete-order affordance
4 Consistency: 3 — edit loading bare-text vs list skeletons; native select vs Radix; skonto sub-box
5 Error Prevention: 3 — zod+dirty-guard+read-only locks; no guard editing invoiced order; two-call partial-save risk
6 Recognition vs Recall: 4 — visible, part picker EK/stock, echoed selection
7 Flexibility & Efficiency: 3 — part auto-fill, staff-rate apply, inline discounts; no keyboard/bulk
8 Aesthetic & Minimalist: 3 — items de-nested now; long monotone stack + skonto card-in-card
9 Error Recovery: 3 — surfaces server msg, generic "Speichern fehlgeschlagen", partial-save ambiguity
10 Help & Documentation: 3 — helpful FormSection/skonto descriptions, "nicht änderbar"

## Anti-Patterns Verdict
LLM: Not slop. Domain edit form; locked customer/vehicle on edit; recent de-nesting removed nested-card tell.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Customer+vehicle locked read-only on edit w/ explanation — prevents integrity mistakes.
2. Form shell — sticky save/cancel busy, unsaved-changes guard, back, orderNumber subtitle.
3. Line-item editing — de-nested rows, live totals, part picker EK, staff-rate apply, discounts.

## Priority Issues
[P1] Edit loading blanks the page — bare "Wird geladen..." replaces whole shell, no header/back/layout, every edit-open flashes it. Fix: render ResourceFormLayout shell + skeleton sections. -> harden/polish
[P2] No lifecycle actions + no invoiced-edit guard — can't delete order (unused footerActions slot); can edit invoiced order's items, desyncs issued invoice. Fix: delete w/ confirm; lock/warn when invoiced. -> harden
[P2] Generic save error + partial-save risk — two-call save (update then updateItems); 2nd fail = half-state w/ generic toast; errors not field-mapped. Fix: clearer copy / transactional save. -> clarify/harden
[P2] Notizen is single-line Input — should be textarea. -> layout/harden

## Persona Red Flags
Stefan: every edit-open flashes blank "Wird geladen" before form.
Riley: edit invoiced order's items no warning; failed 2nd save partial state generic error; long notes single-line.
Sam: inline errors good; bare loading no landmark.
Alex: efficient picker; no shortcuts; load-flash interrupts flow.

## Minor
- Skonto border box inside bordered section — mild card-in-card.
- mileageIn placeholder refs selectedVehicle (disabled query in edit) → static fallback.
- Status label/variant maps duplicated across files.
