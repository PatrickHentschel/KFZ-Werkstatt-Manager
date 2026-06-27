---
target: frontend/src/pages/orders
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-06-25T20-11-42Z
slug: frontend-src-pages-orders
---
# Critique — Orders (OrdersPage · OrderDetailSheet · OrderFormPage)

## Design Health Score: 32/40 (Good)

1 Visibility of System Status: 3 — toasts/badges/pagination solid; bare-text loading, no skeletons, no list counts
2 Match Real World: 4 — deep domain German, de-DE money/dates, mono plates
3 User Control & Freedom: 3 — form dirty-guard; destructive list/sheet actions no confirm; row-open mouse-only
4 Consistency: 3 — status config 4x; native select vs Radix; toast vs inline validation; bare loading vs dashboard skeletons
5 Error Prevention: 3 — great zod+unsaved-guard on form; create-invoice & delete-entry one-click irreversible
6 Recognition vs Recall: 4 — tabs, inline part picker w/ price+stock, echoed selection
7 Flexibility & Efficiency: 3 — inline status advance, part auto-fill, time→labor convert; no keyboard/bulk
8 Aesthetic & Minimalist: 3 — clean tables; form monotone stack of identical bordered sections + nested item cards
9 Error Recovery: 3 — mutation errors → toast w/ server msg; vanishes, no inline persistence
10 Help & Documentation: 3 — helpful FormSection descriptions

## Anti-Patterns Verdict
LLM: Not slop. Hand-built domain software (status graph, time→labor convert, AW/hourly, Skonto, §19). Standard product patterns used right.
Detector: detect.mjs [] exit 0 — clean across all 3 files.
Overlay: unavailable (no browser automation).

## What's Working
1. Unsaved-changes guard (useUnsavedChangesPrompt + AlertDialog + sticky busy footer).
2. Inline status workflow — one-click advance, "Rechnung erstellen" only when done, full switcher in sheet.
3. Part picker + time→labor convert — real workshop intelligence.

## Priority Issues
[P1] Opening an order is mouse-only — <tr onClick>, no tabIndex/role/keyboard. Sam can't open detail. Fix: real button/link trigger or role+tabIndex+key handler. -> harden/adapt
[P1] Irreversible actions no confirm — delete time-entry instant; "Rechnung erstellen" creates invoice + navigates. Fix: AlertDialog confirm or undo toast. -> harden
[P2] Bare loading + dead-end empty states — not carried from dashboard. Fix: skeletons + EmptyState w/ CTA. -> onboard/polish
[P2] Dense grids overflow narrow viewports — 7-col item grid + 8-col part table, no overflow-x/collapse. Fix: overflow-x-auto, stack on mobile. -> adapt
[P2] Form is monotone wall of identical bordered cards w/ nested item cards. Fix: vary rhythm, drop nested border, tighten rows. -> layout

## Persona Red Flags
Sam: can't open order detail by keyboard (mouse-only tr); sheet/form otherwise good.
Alex: loves inline actions; no shortcuts/bulk; order search not debounced; long create scroll.
Riley: narrow viewport overflows dense grids; delete-entry/create-invoice one-click irreversible.

## Minor
- Status label/variant maps defined 4x (list, sheet, form, dashboard) — extract.
- Time-entry validation via destructive toast vs form's inline zod — align.
- Native select vs Radix Select — mixed control vocabulary.
- Order-list search no debounce; part search debounces 300ms.
