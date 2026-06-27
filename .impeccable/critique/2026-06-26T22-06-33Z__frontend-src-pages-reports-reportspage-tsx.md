---
target: frontend/src/pages/reports/ReportsPage.tsx
total_score: 16
p0_count: 2
p1_count: 3
timestamp: 2026-06-26T22-06-33Z
slug: frontend-src-pages-reports-reportspage-tsx
---
## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Six queries, zero loading states — KPI cards show €0,00 while fetching |
| 2 | Match System / Real World | 2 | Period selector doesn't communicate which sections it actually filters |
| 3 | User Control and Freedom | 2 | No preset date ranges; no way to clear/reset; no export |
| 4 | Consistency and Standards | 2 | Sort toggle uses primary CTA style; Package icon means two things; Labels missing htmlFor |
| 5 | Error Prevention | 1 | from > to silently accepted; no query error states; ordersData/partsData ignore date filter |
| 6 | Recognition Rather Than Recall | 3 | Section icons + titles help orientation; period scope ambiguity demands recall |
| 7 | Flexibility and Efficiency | 1 | No preset ranges, no export, no keyboard nav |
| 8 | Aesthetic and Minimalist Design | 2 | Three identical KPI cards = hero-metric template; success color overuse in Rohgewinn card |
| 9 | Error Recovery | 1 | No error states anywhere — failures silently show zeros |
| 10 | Help and Documentation | 1 | No tooltip for gross profit qualifier; no filter scope indication |
| Total | | 16/40 | Poor — major UX overhaul needed |

## Anti-Patterns Verdict
KPI row (three identical cards: text-2xl font-bold + text-sm sub-label + h-4 w-4 icon top-right) = textbook hero-metric template ban. All three metrics (net, tax, gross) read as equally important — they're not. Breakdown section below is better design. Detector: [].

## Overall Impression
Bottom two-thirds shows product thinking. Top third is off-the-shelf scaffolding. Core failure: users can't distinguish €0,00 loading vs. €0,00 no-data.

## What's Working
1. Revenue breakdown bars — custom barWidth calc, cost deductions below. Communicates composition.
2. Low-stock conditional section — only renders when problem exists. Correct use of warning color.
3. Top customers sort toggle — client-side resort, fast. Rank number in monospace is good.

## Priority Issues
[P0] Zero loading states across six queries — KPIs show €0,00 while fetching. Loading vs no-data indistinguishable.
[P0] from > to silently passes — queries fire with inverted dates, silently wrong numbers.
[P1] Hero-metric KPI template — three identical cards, all metrics equal weight, explicit anti-reference.
[P1] ordersData/partsData ignore period filter with no visual indication.
[P1] No error states — query failures silently show zeros.

## Persona Red Flags
Alex: €0,00 on load, no loading signal. No date presets. ordersData/partsData vs revenue data time windows mismatch confusing.
Riley: Inverted date range passes silently. Offline failure shows zeros, no indication.
Sam: Label htmlFor missing. Breakdown bars have no aria-label. Sort toggle missing aria-pressed.

## Minor Observations
- Package icon used for two different concepts (Teile breakdown + low stock alert).
- Rohgewinn card applies text-success to 4 elements — one (the value) is enough.
- Period selector card has no title.
- Staff hours formatting drops trailing zero — toFixed(1) needed.
