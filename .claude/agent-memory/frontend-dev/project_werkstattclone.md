---
name: WerkstattClone frontend project context
description: Core facts about the WerkstattClone KFZ SaaS project — stack, structure, and phase status
type: project
---

WerkstattClone is a multi-tenant KFZ (automotive) workshop management SaaS with a Fastify backend at /backend and a React frontend at /frontend.

**Stack:** React 18 + TypeScript + Vite, TailwindCSS + shadcn/ui primitives (manual install, no CLI), Radix UI, TanStack Query v5, Zustand, React Hook Form + Zod, Axios, React Router v6.

**API base:** `/api/v1` — proxied in dev via Vite to `http://backend:3000`.

**Auth:** JWT access token kept in Zustand memory only (not persisted). Refresh token via httpOnly cookie. Auto-refresh on 401 in `src/api/client.ts`.

**Frontend phase status (as of 2026-03-16):**
- Phase 1 (complete): Directory structure, config, global styles, shadcn/ui components, API layer, Zustand stores, layout (AppShell/Sidebar/Header), auth pages, ProtectedRoute, Dashboard, Customers (with CRUD dialog), Vehicles, Orders, Invoices — all wired to real API.
- Phase 3 (complete): Appointments (Google Calendar OAuth2 — week/month calendar view, EventDialog for CRUD), Parts/inventory (table with search, low-stock filter, inline stock adjustment).
- Phase 4 (complete): Staff (card grid with timer start/stop), Reports (revenue KPIs, order status breakdown, staff hours, low-stock warning), Settings (workshop profile + invoice settings form).
- Order workflow enhancements (2026-03-16): Orders now support `assignedStaffId`, `partId` on items, time entries API (`getTimeEntries`, `addTimeEntry` on ordersApi; `deleteTimeEntry` on staffApi). OrderDialog step 3 has staff assignment dropdown, parts picker popover (inline search below description for type=part), labor item staff-rate auto-fill. New `OrderDetailSheet` (right-side Radix Dialog panel, 600px) with Overview tab (items table + order meta) and Zeiterfassung tab (list entries, add form, convert-to-labor-item action). Rows in OrdersPage are clickable to open the sheet; action buttons stop propagation.

**Why:** Clean architecture for maintainability — one file per page, shared UI primitives in `components/ui`, layout in `components/layout`, shared guards in `components/shared`.

**How to apply:** When adding new pages, follow the pattern: one `*Page.tsx` in the relevant `pages/` subdirectory, a separate `*Dialog.tsx` for CRUD modals, API calls through the typed api layer in `src/api/`, mutations invalidate TanStack Query caches.
