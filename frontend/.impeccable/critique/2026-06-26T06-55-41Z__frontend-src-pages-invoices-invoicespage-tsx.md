---
target: frontend/src/pages/invoices/InvoicesPage.tsx
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-06-26T06-55-41Z
slug: frontend-src-pages-invoices-invoicespage-tsx
---
# Critique — InvoicesPage.tsx (invoices list)

## Design Health Score: 30/40 (Acceptable)

1 Visibility of System Status: 3 — status badges, toasts, PreviewDialog; bare loading, no empty state, no pagination feedback
2 Match Real World: 4 — Entwurf/Offen/Bezahlt/Storniert, Stornorechnung, credit-note rules, de-DE
3 User Control & Freedom: 3 — preview+storno confirm; no pagination UI traps on page 1; rows not interactive
4 Consistency: 3 — tabs not tablist; native confirm() vs AlertDialog; mixed icon/text buttons; title not aria-label
5 Error Prevention: 3 — PreviewDialog before send, storno confirm, status-gated; "Als bezahlt" no confirm/undo
6 Recognition vs Recall: 3 — per-row actions visible; up to 6 buttons per row is a lot
7 Flexibility & Efficiency: 3 — fast status workflow; no pagination, keyboard, bulk
8 Aesthetic & Minimalist: 3 — clean table; busy 6-button cell, bare loading
9 Error Recovery: 3 — mutation + PDF errors → toast w/ server message
10 Help & Documentation: 2 — minimal; PreviewDialog notice helps

## Anti-Patterns Verdict
LLM: Not slop. Status-driven actions + legal correctness (credit notes PDF-only, Storno negative doc). Standard table used right.
Detector: detect.mjs [] exit 0.
Overlay: unavailable (no browser automation).

## What's Working
1. Status-aware action workflow — each row shows only valid actions for its status; legal model encoded in UI.
2. Finalize/send guarded by PreviewDialog (notice: gets running number + issue date on confirm).
3. Storno end-to-end — confirm, negative Stornorechnung, auto-download PDF.

## Priority Issues
[P1] Pagination missing — page/pageSize + totalPages in query but NO prev/next rendered; stuck on first 20, older unreachable. Fix: render pager (copy OrdersPage). -> harden/layout
[P2] No empty state + bare loading — empty result = header row, no body/message; loading plain text. Fix: skeleton + EmptyState (CTA / no-results). -> onboard/harden
[P2] Native confirm() + dense 6-button cell + no overflow — storno uses browser confirm vs app AlertDialog; 6 mixed icon/text buttons; table no overflow-x. Fix: AlertDialog, overflow-x-auto, overflow menu. -> harden/adapt
[P2] A11y + data bug — tabs not tablist; icon buttons title not aria-label; customer name `${first} ${last}${company}` jams business names ("John DoeAcme GmbH"). Fix: tablist ARIA, aria-label, getCustomerName helper. -> harden/clarify

## Persona Red Flags
Riley: can't reach invoice #21+; empty shop blank table; narrow overflow.
Sam: non-tablist tabs, icon buttons title-only, garbled business names.
Alex: efficient actions; no pagination/keyboard/bulk.
Stefan: 6 buttons per row to scan; native confirm jolt off-brand vs PreviewDialog.

## Minor
- "Als bezahlt markieren" no confirm + no inverse action.
- "Versenden" (mark sent) vs Send icon (email) subtly different — clarify.
- Search not debounced.
