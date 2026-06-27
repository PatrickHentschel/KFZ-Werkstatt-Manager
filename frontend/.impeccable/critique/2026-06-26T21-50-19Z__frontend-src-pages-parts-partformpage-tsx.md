---
target: frontend/src/pages/parts/PartFormPage.tsx
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T21-50-19Z
slug: frontend-src-pages-parts-partformpage-tsx
---
# Critique — PartFormPage.tsx

## Design Health Score: 35/40 (Good, top of band) — ship-grade

1 Visibility: 3 — inline errors + busy footer + toasts; edit loading blanks page
2 Match Real World: 4 — SKU/OEM mono, Lagerort, Mindestbestand
3 User Control & Freedom: 4 — dirty-guard, cancel/back
4 Consistency: 3 — native select; labels unassociated; edit-loading bare
5 Error Prevention: 4 — zod (required SKU/name, prices ≥0, int stock); initial stock only on create
6 Recognition vs Recall: 4 — labels, placeholders, required markers, vendor list
7 Flexibility & Efficiency: 3 — simple clean form
8 Aesthetic & Minimalist: 4 — well-grouped, good responsive grids
9 Error Recovery: 3 — toast + server-message fallback
10 Help & Documentation: 3 — placeholders + required markers

## Anti-Patterns Verdict
LLM: Not slop. Real inventory modeling — mono SKU/OEM, location, min-stock, initial stock only on create. Clean.
Overlay: unavailable.

## What's Working
1. Create-vs-edit stock distinction — Anfangsbestand only on create; editing can't overwrite on-hand.
2. Domain-true identification — font-mono SKU/OEM, required markers on SKU/name/prices.
3. Clean grouping + validation — 4 sections, prices ≥0, int stock, sensible grids.

## Priority Issues (all P2/P3 — no P1)
[P2] Edit loading blanks page — recurring; ResourceFormLayout skeleton fix.
[P2] Labels not associated — no htmlFor/id; SR announces unlabeled.
[P3] taxRate placeholder "20" vs default 19 mismatch; Beschreibung single-line vs textarea; no sale>=purchase check (sell-below-cost savable, no live margin).

## Persona Red Flags
Sam: unassociated labels; edit-loading no landmark.
Stefan: fast clear inventory entry.
Riley: sale<purchase savable silently; "20" vs 19 tax hint risk.
