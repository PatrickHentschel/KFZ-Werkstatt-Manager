---
target: frontend/src/pages/dashboard
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-06-25T20-01-30Z
slug: frontend-src-pages-dashboard-dashboardpage-tsx
---
# Critique (re-run) — Dashboard (DashboardPage.tsx)

## Design Health Score: 36/40 (Excellent) — up from 25

1 Visibility of System Status: 3 — states+trend present; no data-freshness signal
2 Match Real World: 4
3 User Control & Freedom: 4 — KPIs/rows drill through, error retry, view-all
4 Consistency: 4 — tokenized badges, uniform link/hover, truthful arrow
5 Error Prevention: 3 — defensive status mapping
6 Recognition vs Recall: 4 — all visible/labeled, drill targets obvious
7 Flexibility & Efficiency: 3 — drill-through; no keyboard accelerators
8 Aesthetic & Minimalist: 4 — hero-metric template broken, hierarchy by urgency
9 Error Recovery: 4 — plain error + cause + Erneut versuchen
10 Help & Documentation: 3 — empty states teach next action

## Anti-Patterns Verdict
LLM: No longer slop. Hero-metric grid gone; revenue leads, overdue self-flags, vanity demoted. Honest directional delta.
Detector: detect.mjs [] exit 0 — clean.
Overlay: unavailable (no browser automation).

## What's Working
1. Hierarchy by urgency — overdue escalates, customer count recedes.
2. Dashboard now acts — every metric/row a real keyboard-focusable link.
3. Honest metrics + recoverable errors — signed delta, no fake +100%, refetch retry.

## Priority Issues (minor — ship-grade)
[P2] No data-freshness signal — cached numbers, no timestamp/refresh. Fix: "aktualisiert vor X" + refresh. -> harden
[P3] No keyboard accelerators — no command palette/shortcuts.
[P3] List rows no count context — "N von total".

## Persona Red Flags
Alex: drill-through solved; no keyboard shortcuts (minor).
Sam: real links + focus-visible rings, text-labeled badges, delta+signed text, AA. Clean.
Stefan: revenue+trend leads, overdue red one-tap to invoices; only gap is data freshness.

## Minor
- Revenue down-month uses warning not destructive (deliberate).
- Badge variant as any remains but defensive (?? secondary).
