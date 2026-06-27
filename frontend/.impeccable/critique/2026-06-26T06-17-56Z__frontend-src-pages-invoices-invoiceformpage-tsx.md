---
target: frontend/src/pages/invoices/InvoiceFormPage.tsx
total_score: 33
p0_count: 0
p1_count: 1
timestamp: 2026-06-26T06-17-56Z
slug: frontend-src-pages-invoices-invoiceformpage-tsx
---
# Critique — InvoiceFormPage.tsx

## Design Health Score: 33/40 (Good)

1 Visibility of System Status: 3 — inline errors, sticky busy footer, draft/created toasts; edit loading blanks page
2 Match Real World: 4 — §14, §19, Skonto, Leistungsdatum, Gutschrift, de-DE
3 User Control & Freedom: 3 — dirty-guard, draft-save, edit-protection; finalize has no confirm
4 Consistency: 3 — lags fixed OrderForm: split Teile-Suche, nested cards, no overflow, mouse-only picker, native select
5 Error Prevention: 3 — zod+dirty-guard+draft-save+§14 edit-lock; finalizing legal doc one unconfirmed click
6 Recognition vs Recall: 4 — part picker, echoed customer, order-link copies items, EK shown
7 Flexibility & Efficiency: 3 — draft-save, order-link, picker, staff-rate; picker keyboard-inaccessible
8 Aesthetic & Minimalist: 3 — nested item cards, Teile-Suche split, monotone stack, dense per-item rows
9 Error Recovery: 3 — generic "Speichern fehlgeschlagen"; no field-mapping
10 Help & Documentation: 4 — outstanding inline help (§14/§19, skonto, order-link, line Leistungsdatum)

## Anti-Patterns Verdict
LLM: Not slop. Legally-aware domain — invoice/quote/credit-note, §14 service-date, §19 0%-tax, Skonto, draft lifecycle.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Draft-save lifecycle — "Als Entwurf speichern" creates draft + redirects to edit URL; further saves update same draft. "Never lose work" done right.
2. §14 edit-protection — finalized invoice can't be edited ("Status final, Storno"), with clear exit. (Guard I had to add to orders shipped here.)
3. §19 + line-level service dates + order-linking — 0%-tax forced/disabled, per-item Leistungsdatum, pick order copies positions.

## Priority Issues
[P1] Edit loading blanks page — bare "Wird geladen..." no shell, every edit-open flashes. Fix: ResourceFormLayout shell + skeleton (reuse OrderForm). -> harden/polish
[P2] Finalize unconfirmed/irreversible — primary submit issues a legal invoice the §14 guard then locks; sits beside "Als Entwurf speichern", subtle distinction. Misclick = Storno-only. Fix: confirm dialog naming consequence + sharper labels. -> harden + clarify
[P2] All OrderForm fixes missing — Teile-Suche split from Positionen; nested item cards; no overflow-x on 7-col grid + 8-col table; part-picker mouse-only <tr>; labels unassociated; single-line Notizen. Fix: carry OrderForm work over. -> layout + harden/adapt

## Persona Red Flags
Riley: accidental finalize → Storno-only; narrow viewport cramps grids.
Sam: unassociated labels, mouse-only picker, edit-loading no landmark.
Stefan: draft-save a relief; finalize button beside it is a foot-gun.
Alex: draft-save/order-link/picker fast; no keyboard add-part.

## Minor
- Skonto card-in-card inside Rechnungsdetails.
- discount + Leistungsdatum row on every item by default — denser than OrderForm; candidate for progressive disclosure.
- "Notizen / Interne Notizen" — clarify whether printed or internal.
