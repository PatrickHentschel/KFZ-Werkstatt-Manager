---
target: frontend/src/pages/vehicles/VehicleFormPage.tsx
total_score: 26
p0_count: 1
p1_count: 4
timestamp: 2026-06-26T22-37-04Z
slug: frontend-src-pages-vehicles-vehicleformpage-tsx
---
## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading = bare text div; no skeleton; VIN counter is a strength |
| 2 | Match System / Real World | 3 | "Sonstiges" too vague; "Stand & HU" opaque to non-mechanics |
| 3 | User Control and Freedom | 3 | Cancel + dirty guard solid |
| 4 | Consistency and Standards | 2 | select h-9/ring-1 vs Input h-10/ring-2; notes still single-line Input; labels lack htmlFor |
| 5 | Error Prevention | 3 | onTouched mode; VIN counter; field constraints good; aria-required missing |
| 6 | Recognition Rather Than Recall | 3 | HSN/TSN description excellent; placeholders throughout; customer search visible |
| 7 | Flexibility and Efficiency | 2 | No Cmd+S; customer search is good power path |
| 8 | Aesthetic and Minimalist Design | 3 | 5 sections meaningfully distinct; "Sonstiges" mixes unrelated fields |
| 9 | Error Recovery | 2 | onTouched inline errors; toast for API; error p elements missing role=alert |
| 10 | Help and Documentation | 3 | HSN/TSN description excellent; VIN counter micro-help done right |
| Total | | 26/40 | Acceptable — best form in codebase so far |

## Priority Issues
[P0] Notes uses Input instead of Textarea.
[P1] Labels missing htmlFor, inputs missing id — same pattern as VendorFormPage.
[P1] select h-9/ring-1 vs Input h-10/ring-2 ring-offset-2 — form control vocabulary inconsistent.
[P1] Customer list no ARIA semantics — no role=listbox, no aria-selected, keyboard users blocked.
[P1] Loading state = bare text div.

## Persona Red Flags
Sam: No listbox role on customer list, no aria-selected. Error p has no role=alert. Asterisk not aria-hidden.
Jordan: Notes field — Enter key submits form. Stand & HU section title cryptic.
Alex: Cmd+S nothing. Customer search fast — good.
