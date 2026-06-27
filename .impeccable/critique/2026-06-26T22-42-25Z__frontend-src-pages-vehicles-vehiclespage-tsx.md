---
target: frontend/src/pages/vehicles/VehiclesPage.tsx
total_score: 18
p0_count: 1
p1_count: 3
timestamp: 2026-06-26T22-42-25Z
slug: frontend-src-pages-vehicles-vehiclespage-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Text-only loading; delete has no in-flight state; no pagination feedback |
| 2 | Match System / Real World | 3 | Domain terms correct (Kennzeichen, FIN, KM-Stand); missing year column breaks real-world mental model |
| 3 | User Control and Freedom | 1 | Browser confirm() is the only undo; no filter clear; no escape from accidental delete |
| 4 | Consistency and Standards | 2 | confirm() breaks design system; icon-only actions inconsistent with a11y standards elsewhere |
| 5 | Error Prevention | 2 | confirm() barely counts; no delete loading state means double-fire risk; no soft-delete |
| 6 | Recognition Rather Than Recall | 2 | Icon-only edit/delete buttons — no labels, no tooltips |
| 7 | Flexibility and Efficiency | 1 | No sorting, no bulk action, no keyboard shortcuts, pagination UI missing entirely |
| 8 | Aesthetic and Minimalist Design | 3 | Clean table, correct mono on plates/VIN, tabular-nums on mileage |
| 9 | Error Recovery | 1 | deleteMutation has no onError; failed deletes silently vanish |
| 10 | Help and Documentation | 1 | No empty state, no tooltips, no contextual help anywhere |
| **Total** | | **18/40** | **Poor — core experience has broken paths** |

## Anti-Patterns Verdict
Clean detector scan ([]). LLM: Generic scaffold — text-3xl heading, search bar, card table, ghost icon buttons. License plate is the automotive primary identifier but renders identically to customer name column. No domain visual identity.

## Overall Impression
Functional skeleton with two broken paths: pagination unreachable (page controls never rendered), errors silently dropped (no onError on delete mutation). Fix mechanics first.

## Priority Issues
[P0] Pagination UI missing — page state exists, pageSize:20 passed to API, no next/prev controls rendered. Vehicles past #20 unreachable.
[P1] Browser confirm() for delete — outside design system, no loading state, double-fire risk. Replace with AlertDialog + isPending guard.
[P1] No empty state — filtered or new-tenant table body renders nothing. Replace with contextual empty message + CTA.
[P1] deleteMutation has no onError — failed deletes silently vanish with no user feedback.
[P2] No year column — automotive context requires model year at a glance; VehicleFormPage collects it but VehiclesPage never surfaces it.

## Persona Red Flags
Alex: Can't reach page 2+. No column sorting. No keyboard shortcut for new vehicle. Bulk delete requires N confirm dialogs.
Sam: Edit/delete buttons have no aria-label. Danger conveyed by color (text-destructive) only — no label or alt text pairing.
Workshop Reception (project-specific): Filtered empty state gives no signal when plate doesn't exist. Year absent forces second click. No click-to-navigate from vehicle row to customer.

## Minor Observations
- data?.data.data triple-nesting smell
- text-xs on VIN vs text-sm elsewhere
- h1 text-3xl font-bold too heavy for product list header
- Search input no aria-label (placeholder only)
