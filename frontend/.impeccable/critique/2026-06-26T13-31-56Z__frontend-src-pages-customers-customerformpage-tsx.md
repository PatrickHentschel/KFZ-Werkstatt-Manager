---
target: frontend/src/pages/customers/CustomerFormPage.tsx
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T13-31-56Z
slug: frontend-src-pages-customers-customerformpage-tsx
---
# Critique — CustomerFormPage.tsx

## Design Health Score: 36/40 (Excellent)

1 Visibility of System Status: 3 — inline errors, sticky busy footer, toasts; edit loading blanks page
2 Match Real World: 4 — German salutation, PLZ/phone format, Privatperson/Unternehmen
3 User Control & Freedom: 4 — dirty-guard, cancel/back
4 Consistency: 3 — native select; labels not associated; edit-loading bare vs other surfaces
5 Error Prevention: 4 — strong zod (PLZ 5-digit, phone/house regex, name-or-company required, email)
6 Recognition vs Recall: 4 — labels, format placeholders, required markers, type toggle
7 Flexibility & Efficiency: 3 — simple form; no autoComplete (browser autofill blocked)
8 Aesthetic & Minimalist: 4 — clean, well-grouped, good responsive grids, radio-card type toggle
9 Error Recovery: 3 — error toast; no message fallback if server omits one
10 Help & Documentation: 4 — format placeholders + required markers + inline validation teach

## Anti-Patterns Verdict
LLM: Not slop. Real German validation (5-digit PLZ, +49/0 phone, house-number "12a", superRefine name-vs-company). Clean, correct.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Thorough domain validation — superRefine name/company required + PLZ/phone/house regex; errors inline.
2. Type toggle — radio-styled cards, real sr-only radios, selected via bg-primary/10; swaps fields conditionally.
3. Considerate detail — format placeholders, required markers, sensible responsive grids.

## Priority Issues (all P2/P3 — ship-grade)
[P2] Edit loading blanks page — bare "Wird geladen..." no shell, every edit-open flashes. Fix: ResourceFormLayout shell + skeleton. -> harden/polish
[P2] A11y — labels unassociated (no htmlFor/id); type-toggle sr-only radios have no visible keyboard focus. Fix: htmlFor/id; focus-within:ring on toggle cards. -> harden
[P3] No autoComplete (autofill blocked); error toast no fallback message; birthDate allows future (max=today).

## Persona Red Flags
Sam: inputs announced unlabeled; toggle invisible when focused; edit-loading no landmark.
Alex: no autofill — retypes known email/address.
Riley: future birthdate savable; edit-open flash.
Stefan: smooth fast intake — clearest fields + instant validation in the app.

## Minor
- Native select for Anrede vs Radix elsewhere.
- Customer savable with no contact info — fine for walk-ins, deliberate?
