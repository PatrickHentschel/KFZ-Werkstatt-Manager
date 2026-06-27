---
target: frontend/src/pages/parts/VendorFormPage.tsx
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-06-26T21-58-35Z
slug: frontend-src-pages-parts-vendorformpage-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading = bare text div, no skeleton; success via toast only |
| 2 | Match System / Real World | 3 | German labels natural; bg-warning/10 on not-found is semantically wrong |
| 3 | User Control and Freedom | 3 | Dirty guard excellent; cancel always visible; back button clear |
| 4 | Consistency and Standards | 2 | Label has no htmlFor; Input for multi-line notes breaks form conventions |
| 5 | Error Prevention | 2 | Input for notes (can't type multi-line); no format hint for phone |
| 6 | Recognition Rather Than Recall | 3 | Placeholders give examples; section titles orient the user |
| 7 | Flexibility and Efficiency | 2 | No Cmd+S to submit; no tab-order shortcut between sections |
| 8 | Aesthetic and Minimalist Design | 2 | Three full FormSection cards for 6 fields; one card wrapping one input is disproportionate |
| 9 | Error Recovery | 2 | Inline errors for name/email only; server errors toast but don't map to fields |
| 10 | Help and Documentation | 2 | Placeholders help but no address format guidance; no contextual hints |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

LLM: Form IS the anti-reference. PRODUCT.md names "generic shadcn demo" — three titled card sections, each with rounded-lg border bg-card p-6. That is precisely this. Automated detector: []. Zero flagged. Issues are structural and semantic, not stylistic.

## Overall Impression

Solid skeleton — dirty guard, TanStack Query, schema validation — but the UI layer was written to "work" not "be finished." Using Input for notes means users literally cannot write multi-line notes. Over-sectioned card layout makes this 6-field form feel complex.

## What's Working

1. Dirty guard + AlertDialog — unsaved work protected. Core product promise delivered.
2. Placeholder text — every field has a concrete example. Users know what's expected.
3. Sticky footer with submit state — "Wird gespeichert..." during mutation.

## Priority Issues

[P0] Input for notes — wrong affordance. Users can't type multi-line. Fix: textarea with rows=3.
[P1] Labels have no htmlFor — accessibility failure. Clicking label doesn't focus input. Screen readers cannot associate label with control.
[P1] Three FormSection cards for 6 fields — one card for one input wastes vertical space. Merge Notizen into Kontakt.
[P2] Loading state is unstyled text — bare div, no skeleton, layout shift.
[P2] Wrong semantic color for not-found — bg-warning on missing record should be bg-muted.

## Persona Red Flags

Jordan: Types long note, can't press Enter, discovers mid-sentence. Warning color on not-found confuses.
Sam: No htmlFor so clicking label doesn't focus input. Required asterisk not announced by screen reader.
Alex: Cmd+S doesn't save. Can't add multi-line notes. Three cards for 6 fields, excess scrolling.

## Minor Observations

- contactPerson in Stammdaten is defensible per German business software convention.
- Address as single Input acceptable for small-shop context.
- VENDORS_TAB_URL constant correct; could use shared route constant if app grows.
