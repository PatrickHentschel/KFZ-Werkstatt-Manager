---
target: frontend/src/pages/invoices/PreviewDialog.tsx
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-26T11-05-41Z
slug: frontend-src-pages-invoices-previewdialog-tsx
---
# Critique — PreviewDialog.tsx

## Design Health Score: 32/40 (Good)

1 Visibility of System Status: 3 — spinner + pending + error toast; failed load = blank body
2 Match Real World: 4 — "Vorschau vor Versand", German, notice explains number assignment
3 User Control & Freedom: 4 — Radix (Esc/overlay/X), Abbrechen, pending disables
4 Consistency: 3 — standard Radix; missing aria-describedby (console warning)
5 Error Prevention: 2 — confirm disabled while loading; ENABLED after load failure (send blind)
6 Recognition vs Recall: 4 — title, notice, labels visible
7 Flexibility & Efficiency: 3 — fine confirm modal; no open-in-tab/download escape
8 Aesthetic & Minimalist: 4 — clean, focused
9 Error Recovery: 2 — error → fleeting toast only; blank body, no retry
10 Help & Documentation: 3 — notice banner earns its place

## Anti-Patterns Verdict
LLM: Not slop. Focused preview modal; blob lifecycle (create→revoke on cleanup, cancelled flag) textbook-correct.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Disciplined blob lifecycle — objectURL revoked on unmount, cancelled flag vs races.
2. Confirm gated on preview loading (disabled while loading).
3. Proper Radix modal + warning-toned notice explaining what confirm does.

## Priority Issues
[P2] Failed PDF load = blank body + send blind — on getPdf error loading=false, pdfUrl=null → empty body; disabled={pending||loading} re-enables Confirm with no preview. Defeats "Vorschau vor Versand" — can send legal invoice never seen. Fix: in-body error state + retry; disabled={pending||loading||!pdfUrl}. -> harden
[P2] iframe PDF won't render on many mobile/tablet browsers → blank frame on shop tablet. Fix: fallback "In neuem Tab öffnen"/download. -> adapt/harden
[P3] missing aria-describedby on Dialog.Content (Radix warning); spinner no motion-reduce; overlay+content both z-50 (no semantic scale).

## Persona Red Flags
Riley: kill network mid-open → blank modal, enabled Confirm, sends with no preview.
Casey: garage tablet → blank iframe, can't see PDF.
Sam: Radix missing-description warning; mechanics otherwise sound.
Stefan: trusts preview, flaky load sends something unreviewed.

## Minor
- Title always "Vorschau vor Versand" even for email action.
- 90vh good; very short viewports cramp the iframe but it scrolls.
