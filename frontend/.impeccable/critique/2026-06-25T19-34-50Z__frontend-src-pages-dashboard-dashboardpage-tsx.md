---
target: frontend/src/pages/dashboard
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-06-25T19-34-50Z
slug: frontend-src-pages-dashboard-dashboardpage-tsx
---
# Critique — Dashboard (DashboardPage.tsx)

## Design Health Score: 25/40 (Acceptable)

1 Visibility of System Status: 3 — states present, no delta/last-updated
2 Match Real World: 4 — German domain terms, de-DE currency
3 User Control & Freedom: 2 — dead-end cards/rows, no "view all"
4 Consistency: 3 — tokenized badges; static TrendingUp icon misleads
5 Error Prevention: 3 — read-only surface
6 Recognition vs Recall: 3 — labeled/visible, but no drill-through
7 Flexibility & Efficiency: 1 — no click-through/shortcuts
8 Aesthetic & Minimalist: 2 — 4 identical KPI cards, hero-metric template, no hierarchy
9 Error Recovery: 2 — plain error text, no retry
10 Help & Documentation: 2 — none; empty states teach nothing

## Anti-Patterns Verdict
LLM: Partially slop. KPI band = banned hero-metric/identical-card-grid template. Bones better than typical (real loading/error/empty states, semantic tokenized badges, i18n).
Detector: detect.mjs [] exit 0 — clean.
Overlay: unavailable (no browser automation this session).

## What's Working
1. Real states — skeleton loader, error branch, per-list empty states.
2. Status glance-able/honest — success/warning/destructive tokens, text labels, overdue flips destructive only when >0.
3. Speaks shop language — Warte auf Teile, Verrechnet, de-DE currency.

## Priority Issues
[P1] Hero-metric template, no hierarchy — 4 identical cards; vanity count = urgent overdue. Fix: differentiate by urgency, break uniform grid. -> layout/bolder
[P1] KPIs & rows dead divs, no drill-through — can't click "3 overdue". No "Alle anzeigen". Fix: real links to filtered/detail. -> layout/harden
[P1] TrendingUp icon lies — hardcoded up-arrow regardless of direction; "Vormonat" plain text, no delta. Fix: compute delta, +/-% in success/warning with real arrow. -> clarify
[P2] Empty states thin — first-run is dashes + "Keine vorhanden". Fix: CTA empty states. -> onboard
[P2] Error state no recovery — no retry button. Fix: "Erneut versuchen" -> refetch(). -> harden

## Persona Red Flags
Alex (Power User): no clickable metric/view-all/keyboard path; manual sidebar trips.
Sam (A11y): revenue direction via icon alone; overdue AlertTriangle stays gray; clickable cards must be real a/button.
Stefan (Workshop owner): urgent metric buried 4th and untappable; fails glance-able→fast-path principle.

## Minor
- Badge variant as any: unmapped status renders blank badge.
- Overdue AlertTriangle should go destructive when count>0.
- Revenue mixes stats!==undefined and stats?. styles.
