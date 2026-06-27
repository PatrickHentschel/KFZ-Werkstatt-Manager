---
target: frontend/src/pages/auth/LoginPage.tsx
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T13-37-23Z
slug: frontend-src-pages-auth-loginpage-tsx
---
# Critique — LoginPage.tsx

## Design Health Score: 32/40 (Good)

1 Visibility of System Status: 4 — button spinner + disabled, inline + root errors
2 Match Real World: 4 — German, "Melden Sie sich in Ihrer Werkstatt an"
3 User Control & Freedom: 3 — register link; no forgot-password
4 Consistency: 4 — labels associated (htmlFor/id); minor text-white vs token
5 Error Prevention: 3 — zod, no credential leak; no password-manager support; min(6) can block valid pw
6 Recognition vs Recall: 3 — labels/placeholders clear; no autofill → retype creds
7 Flexibility & Efficiency: 2 — no autoComplete, no autoFocus, no show-password on most-repeated action
8 Aesthetic & Minimalist: 3 — clean but generic centered card; brand-adjacent first impression left default
9 Error Recovery: 4 — specific 401/403 copy + generic fallback, root error shown
10 Help & Documentation: 2 — register link only; no forgot-password/help

## Anti-Patterns Verdict
LLM: Functionally clean but the most templated auth screen — muted bg, white max-w-md card, logo-in-circle, 2 fields, full-width button. Not wrong, but carries none of the "sturdy workshop" brand on the one first-impression surface. Trustworthy, unmemorable.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Security-aware errors — 401/403 "E-Mail oder Passwort ist falsch" without revealing which (no enumeration) + generic fallback.
2. Labels associated (htmlFor/id) — better than the domain forms; queryClient.clear() on login.
3. Clean form mechanics — zod, inline + root errors, spinner + disabled in flight.

## Priority Issues
[P2] No password-manager support — fields lack autoComplete=email/current-password; no autoFocus; no show/hide. Login is most-repeated action. Fix: autoComplete both, autoFocus email, show-password toggle. -> harden
[P2] Brand-adjacent first impression left generic — default centered card, says nothing of product; a login can earn committed brand. Fix: brand the auth surface (petrol, wordmark, split panel/tagline). -> bolder/colorize/delight
[P3] text-white vs text-primary-foreground; password min(6) on login can reject valid short pw (use non-empty); spinner no motion-reduce; no "Passwort vergessen?".

## Persona Red Flags
Alex: password manager not wired — expects fill, retypes.
Casey: no autofill on garage phone; manual entry every shift.
Riley: legit 5-char password blocked client-side by min(6).
Jordan: clear enough; register link visible; no forgot-password safety net.

## Minor
- bg-muted page — fine, but a deliberate brand choice beats default.
- Single-icon-in-circle logo is the common AI auth treatment.
