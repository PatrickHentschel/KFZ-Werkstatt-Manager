# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Multi-tenant SaaS with a monorepo structure. Strict frontend/backend split. REST API with JWT authentication and Postgres Row-Level Security (RLS) for tenant isolation.

**Key Characteristics:**
- All data is scoped to a `tenantId` (one tenant = one workshop). Every DB table carries a `tenant_id` column.
- RLS is enforced at the Postgres level via a GUC (`app.current_tenant_id`), set per request by the auth plugin. This means even a buggy query cannot leak cross-tenant data.
- Access tokens live in memory only; refresh tokens are stored as hashed values in `refresh_tokens` table and rotated on every `/refresh` call.
- Appointments are backed exclusively by Google Calendar — there is no local `appointments` table for events. The `appointments` table in the schema only stores reminder metadata.
- Payments support two modes: demo (no Stripe) and real Stripe checkout, selected at startup by the presence of `STRIPE_SECRET_KEY`.

## Layers

**Frontend (React SPA):**
- Purpose: User-facing workshop management UI
- Location: `frontend/src/`
- Contains: Pages, components, API client, Zustand stores, React Query hooks
- Depends on: Backend REST API at `/api/v1`
- Used by: End users (workshop owners, admins, technicians, reception)

**Backend (Fastify API):**
- Purpose: Business logic, data access, external integrations
- Location: `backend/src/`
- Contains: Route handlers, service classes, Drizzle ORM schema, utility functions
- Depends on: PostgreSQL, Google Calendar API, Stripe, SMTP
- Used by: Frontend, Stripe webhooks

**Shared Package:**
- Purpose: TypeScript type contracts shared between frontend and backend
- Location: `packages/shared/src/types/`
- Contains: `JwtPayload`, `UserRole`, `PaginatedResponse`, `ApiError`, and domain interface types
- Consumed by: Both `@werkstatt/backend` and `@werkstatt/frontend` via npm workspaces

## Data Flow

**Authenticated Request Flow:**

1. Frontend attaches `Authorization: Bearer <accessToken>` header via Axios request interceptor (`frontend/src/api/client.ts`)
2. Fastify `authenticate` decorator in `backend/src/plugins/auth.ts` verifies the JWT and extracts `tenantId`
3. Plugin checks out a dedicated pg pool client, sets the GUC `app.current_tenant_id = tenantId` via `SET CONFIG`
4. A per-request `tenantDb` Drizzle instance is stored in `AsyncLocalStorage` (`tenantDbStore`)
5. Route handler calls the module's service class, which queries via `db` proxy — the proxy reads from `AsyncLocalStorage` so every query automatically targets the right tenant
6. `onResponse` hook releases the pool client and clears the GUC

**Token Refresh Flow:**

1. On 401, Axios response interceptor in `frontend/src/api/client.ts` calls `POST /api/v1/auth/refresh`
2. The `werkstatt_refresh` HttpOnly cookie is sent automatically (same-site strict, path `/api/v1/auth`)
3. Backend verifies the refresh JWT, checks the hashed token in `refresh_tokens`, revokes it, and issues a new pair
4. New access token is stored in Zustand memory state; refresh token goes back as a cookie
5. Queued failed requests are replayed with the new token

**Invoice-to-PDF Flow:**

1. `POST /api/v1/invoices/:id/send` is called
2. `invoicesService.getById()` loads the invoice with items
3. `generateInvoicePdf()` (`backend/src/utils/pdf.ts`) builds a PDF with pdfkit
4. `sendEmail()` (`backend/src/utils/email.ts`) sends the PDF as an attachment via nodemailer/SMTP
5. Invoice status is updated to `sent` if it was `draft`

**State Management (Frontend):**
- `useAuthStore` (Zustand + persist): holds `user` and `isAuthenticated` in `localStorage`; access token intentionally NOT persisted (memory only)
- `useUIStore` (Zustand, no persist): sidebar open/close state
- Server state: All domain data (orders, invoices, customers, etc.) managed by TanStack React Query — no manual caching

## Key Abstractions

**Module (Backend):**
- Purpose: Self-contained vertical slice for each domain entity
- Pattern: Each module = `{name}.routes.ts` + `{name}.service.ts` (appointments is the exception: it has a `google-calendar.service.ts` instead of a plain service)
- Examples: `backend/src/modules/orders/`, `backend/src/modules/invoices/`

**Service Class (Backend):**
- Purpose: Contains all business logic and DB queries for a domain; instantiated as a singleton
- Pattern: `export class OrdersService { ... }` then `export const ordersService = new OrdersService();`
- Examples: `backend/src/modules/orders/orders.service.ts`, `backend/src/modules/invoices/invoices.service.ts`

**API Module (Frontend):**
- Purpose: Typed wrappers around `apiClient` for each domain
- Pattern: Flat object with named async functions returning Axios response promises
- Examples: `frontend/src/api/orders.api.ts`, `frontend/src/api/invoices.api.ts`

**Page Component (Frontend):**
- Purpose: Top-level route component containing data fetching, list rendering, and dialog state
- Pattern: Co-located with domain-specific dialog/sheet components in the same directory
- Examples: `frontend/src/pages/orders/OrdersPage.tsx` + `OrderDialog.tsx` + `OrderDetailSheet.tsx`

**Payment Provider:**
- Purpose: Abstraction layer over Stripe or demo mode
- Interface: `backend/src/modules/payments/payments.provider.ts` — `PaymentProvider` interface
- Implementations: `payments.stripe.ts` and `payments.demo.ts`; selected at runtime by `createPaymentProvider()`

## Entry Points

**Backend Server:**
- Location: `backend/src/server.ts`
- Triggers: `npm run dev` (ts-node-dev) or `node dist/server.js` (production)
- Responsibilities: Loads env, calls `buildApp()`, listens on `PORT`, starts appointment reminder cron

**Fastify App Factory:**
- Location: `backend/src/app.ts`
- Triggers: Called by `server.ts`
- Responsibilities: Registers plugins (cors, helmet, rate-limit, cookies), decorates with `db`, registers all 12 module route groups under `/api/v1/*`, sets global error handler

**Frontend Entry:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite dev server or static build
- Responsibilities: Mounts React app

**React Root:**
- Location: `frontend/src/App.tsx`
- Responsibilities: Wraps app in `QueryClientProvider`, defines all routes, wraps protected routes in `ProtectedRoute`

## Error Handling

**Strategy:** Centralized on the backend via Fastify's `setErrorHandler`. Frontend relies on Axios interceptors and per-query error states in React Query.

**Backend Patterns:**
- `AppError` class (`backend/src/utils/errors.ts`) carries `statusCode` and `error` label
- `errors.*` factory (`errors.notFound()`, `errors.unauthorized()`, etc.) used throughout service classes
- Zod parse errors are caught and returned as 400 with the parsed Zod message
- Unhandled errors return 500 with the stack in development, generic message in production

**Frontend Patterns:**
- 401 responses trigger automatic token refresh via interceptor; on failure, logout + redirect to `/login`
- React Query `onError` callbacks used per-query for toast notifications

## Cross-Cutting Concerns

**Logging:** Fastify built-in pino logger. Level configurable via `LOG_LEVEL` env var (default `info`). Unhandled errors logged with `fastify.log.error`.

**Validation:** Zod used for all request body validation in route handlers. Parse called directly with `.parse()` — throws on failure, caught by global error handler.

**Authentication:** `fastify.authenticate` preHandler decorator. Applied as `fastify.addHook('preHandler', fastify.authenticate)` at the router level for most modules, or per-route where mixed auth/unauth routes exist (e.g., payments webhook).

**Authorization:** `fastify.requireRole(...roles)` preHandler decorator. Roles: `owner`, `admin`, `technician`, `reception`. Applied per-route on write operations. Read endpoints generally require only authentication.

**Tenant Isolation:** Postgres RLS via GUC + per-request Drizzle instance in AsyncLocalStorage. All service queries use `request.user.tenantId` as the primary filter — defense in depth on top of RLS.

**Multi-tenancy Registration:** `POST /api/v1/auth/register` creates a `tenant` row and an `owner` user atomically.

**Background Jobs:** `startAppointmentReminderJob()` (`backend/src/jobs/appointmentReminders.ts`) runs every 15 minutes via `setInterval`. Sends email reminders 24h before appointment start. Only started if `SMTP_HOST` is configured.

---

*Architecture analysis: 2026-04-17*
