# Product

## Register

product

## Users

Staff at a single automotive repair shop — owner/admin, reception, technicians — sharing one multi-tenant app. No single primary role; the same screens get used by someone running the business, someone doing fast customer intake at the desk, and someone on the floor pulling up a work order. Context is a busy shop: interruptions, half-finished tasks, phone in one hand. The job: move a car from intake → work order → invoice → paid without losing work in progress.

## Product Purpose

WerkstattClone runs the whole operation of a small workshop — customers, vehicles, work orders, invoices, appointments, staff, parts. It exists so an owner can manage the shop end-to-end in one place instead of paper + spreadsheets + a legacy ERP. Success = nothing falls through the cracks (drafts survive, status is always visible) and routine actions are fast enough to do mid-conversation with a customer.

## Brand Personality

Sturdy, no-nonsense, fast. A workshop tool, not a SaaS showpiece. It should feel reliable and get out of the way: function first, every common action one or two clicks deep, status legible at a glance. Confident and clean, never decorative.

## Anti-references

- **Generic shadcn demo** — the current state. Default-blue, flat, looks like every other AI-built app. Must not ship as-is.
- **Cluttered legacy ERP** — SAP / old auto-shop software. Dense gray tables, hundreds of buttons, no hierarchy. The thing we're replacing.
- **Consumer / playful app** — rounded-bubbly, emoji, gradient-happy. Too casual for a business that handles money.
- **Heavy enterprise dashboard** — chart-soup, gauge widgets, dark "command center" theatrics. Overkill for a small shop.

## Design Principles

- **Function before flourish.** Every element earns its place by serving a task. No decoration that doesn't aid comprehension or speed.
- **Never lose work.** Drafts persist, status is always visible, destructive actions are recoverable. Trust is the product.
- **Glance-able status.** Where a car/order/invoice stands is readable in under a second — clear states, not buried in a row of identical text.
- **Fast paths for shared screens.** Designed for mixed roles doing repeated actions; the common path is the short path.
- **Quiet density.** Show enough on one screen to avoid hunting, without the ERP wall of gray. Hierarchy and spacing do the organizing.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Full keyboard navigation (all-day data entry, not mouse-only). Visible focus states. Status never conveyed by color alone — pair with label/icon (color-blind safety matters for order/invoice states). Honor `prefers-reduced-motion`. Body text and placeholders meet 4.5:1 contrast.
