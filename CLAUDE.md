<!-- GSD:project-start source:PROJECT.md -->

## Project

**WerkstattClone**

Multi-tenant workshop management app for automotive repair shops. Manages customers, vehicles, work orders, invoices, appointments, staff, and parts inventory. Built with Fastify + Drizzle + PostgreSQL backend and React + Vite frontend.

**Core Value:** Workshop owners can manage their entire operation — from customer intake to paid invoice — without losing work in progress.

### Constraints

- **Tech stack**: Existing Fastify + Drizzle + React + TanStack Query — no new dependencies
- **Schema**: No migrations needed — `draft` status and `quote` type already in DB schema
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.5.4 — all frontend and backend source code
- SQL — PostgreSQL migrations in `backend/src/db/migrations/`
- JavaScript — config files (`tailwind.config.js`, `postcss.config.js`)

## Runtime

- Node.js (system: v24; no `.nvmrc` pinning detected)
- npm workspaces (monorepo root: `package.json`)
- Lockfile: `package-lock.json` present at root and `backend/`

## Monorepo Structure

- `packages/shared` → `@werkstatt/shared` — shared TypeScript types (e.g., `JwtPayload`)
- `backend` → `@werkstatt/backend`
- `frontend` → `@werkstatt/frontend`

## Frameworks

- Fastify 4.28.1 — HTTP server (`backend/src/server.ts`, `backend/src/app.ts`)
- React 18.3.1 — UI framework (`frontend/src/main.tsx`)
- React Router DOM 6.25.1 — client-side routing
- TanStack React Query 5.51.11 — server state management and caching
- Zustand 4.5.4 — client state (auth store: `frontend/src/store/auth.store.ts`, UI store: `frontend/src/store/ui.store.ts`)
- Vite 5.3.5 — frontend bundler and dev server (port 5173, proxies `/api` → `http://backend:3000`)
- `@vitejs/plugin-react` ^4.3.1 — React fast refresh
- `ts-node-dev` ^2.0.0 — backend dev server with hot reload
- `tsx` ^4.17.0 — backend scripts (migrations, seeds)
- Not detected — no test framework or test files found.

## Key Dependencies

- `drizzle-orm` ^0.33.0 — type-safe ORM for PostgreSQL
- `drizzle-kit` ^0.24.0 — schema migrations and Drizzle Studio
- `pg` ^8.12.0 — PostgreSQL client (connection pool, max 20 connections)
- `jsonwebtoken` ^9.0.2 — JWT access/refresh token signing and verification
- `bcryptjs` ^2.4.3 — password hashing
- `zod` ^3.23.8 — runtime request validation
- `googleapis` ^140.0.0 — Google Calendar API v3 integration
- `google-auth-library` ^9.13.0 — Google OAuth2 client
- `stripe` ^20.4.1 — Stripe Checkout (API version `2026-02-25.clover`)
- `nodemailer` ^6.9.14 — SMTP email (appointment reminders, invoice sending)
- `pdfkit` ^0.15.2 — server-side PDF generation for invoices
- `uuid` ^10.0.0 — UUID generation
- `dotenv` ^16.4.5 — environment variable loading
- `fastify-plugin` ^4.5.1 — Fastify plugin decorator utility
- `axios` ^1.7.3 — HTTP client with JWT interceptor and auto-refresh (`frontend/src/api/client.ts`)
- `react-hook-form` ^7.52.1 — form state management
- `@hookform/resolvers` ^3.9.0 — Zod integration for react-hook-form
- `zod` ^3.23.8 — form schema validation
- `@radix-ui/*` — accessible headless UI primitives (dialog, dropdown, select, tabs, toast, tooltip, avatar, alert-dialog, label, separator, slot)
- `tailwindcss` ^3.4.7 — utility-first CSS
- `tailwindcss-animate` ^1.0.7 — animation utilities
- `class-variance-authority` ^0.7.0 — component variant management
- `clsx` ^2.1.1 + `tailwind-merge` ^2.4.0 — conditional className merging
- `lucide-react` ^0.414.0 — icon library
- `date-fns` ^3.6.0 — date formatting

## Database

- PostgreSQL 16 (Alpine) — Docker image `postgres:16-alpine`
- ORM: Drizzle ORM with `node-postgres` driver
- Schema location: `backend/src/db/schema/` (tables: `tenants`, `users`, `customers`, `vehicles`, `orders`, `invoices`, `parts`, `staff`, `appointments`, `google_tokens`)
- Migrations: `backend/src/db/migrations/` (run with `tsx src/db/migrate.ts`)
- Drizzle config: `backend/drizzle.config.ts`

## Configuration

- Variables injected via `docker-compose.yml`; read in `backend/src/config.ts`
- Sensitive values (JWT secrets, SMTP password, Stripe keys) read from env vars OR Docker secrets files at `/run/secrets/<name>`
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — token signing secrets
- `JWT_ACCESS_EXPIRES_IN` (default: 15m) / `JWT_REFRESH_EXPIRES_IN` (default: 7d)
- `PORT` (default: 3000)
- `FRONTEND_URL` — CORS allow-origin
- `NODE_ENV` — controls secure cookies and error verbosity
- `LOG_LEVEL` (default: info)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `SMTP_PASS`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- `VITE_API_URL` — API base URL (defaults to `/api/v1`)
- Frontend: `tsc && vite build` → `frontend/dist/`
- Backend: `tsc` → `backend/dist/`
- Shared: `tsc` → `packages/shared/dist/`

## Platform Requirements

- Docker + Docker Compose (all services run via `docker-compose up`)
- Ports: frontend 5273, backend 3009, PostgreSQL 5537
- Docker Compose (`docker-compose.prod.yml`)
- Nginx (Alpine) as reverse proxy with TLS termination via Certbot/Let's Encrypt
- Docker secrets for sensitive values
- Nginx config: `docker/nginx/conf.d/`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## File Naming

- Components: `PascalCase.tsx` (e.g., `InvoiceDialog.tsx`)
- API modules: `kebab-case.api.ts` (e.g., `invoices.api.ts`)
- Backend modules: `module.routes.ts` / `module.service.ts` / `module.schema.ts`
- Shared types: `module.types.ts`

## Frontend Component Pattern

- Named exports (not default)
- Page components use `useQuery` + `useMutation` from TanStack Query
- Dialog/form components use `useForm` + `zodResolver`
- No local state for server data — all via TanStack Query

## Frontend API Pattern

## Backend Module Pattern

- Fastify plugin per module (routes file exports plugin)
- Class-based service singletons with tenant-scoped methods
- `errors.notFound()` factory for 404s
- Route params typed via Fastify generics (frequent `as any` workaround)

## Error Handling

- Backend: `AppError` class with HTTP status
- Frontend: `onError` callback → toast notification; 401 interceptor triggers token refresh

## TypeScript

- Strict mode on both frontend and backend
- `@/*` path alias on frontend only
- Shared types imported from `packages/shared`

## Imports

- Frontend: `@/components/...`, `@/lib/...`, `@/hooks/...`
- Backend: relative imports
- Shared package imported as `@werkstatt/shared`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- All data is scoped to a `tenantId` (one tenant = one workshop). Every DB table carries a `tenant_id` column.
- RLS is enforced at the Postgres level via a GUC (`app.current_tenant_id`), set per request by the auth plugin. This means even a buggy query cannot leak cross-tenant data.
- Access tokens live in memory only; refresh tokens are stored as hashed values in `refresh_tokens` table and rotated on every `/refresh` call.
- Appointments are backed exclusively by Google Calendar — there is no local `appointments` table for events. The `appointments` table in the schema only stores reminder metadata.
- Payments support two modes: demo (no Stripe) and real Stripe checkout, selected at startup by the presence of `STRIPE_SECRET_KEY`.

## Layers

- Purpose: User-facing workshop management UI
- Location: `frontend/src/`
- Contains: Pages, components, API client, Zustand stores, React Query hooks
- Depends on: Backend REST API at `/api/v1`
- Used by: End users (workshop owners, admins, technicians, reception)
- Purpose: Business logic, data access, external integrations
- Location: `backend/src/`
- Contains: Route handlers, service classes, Drizzle ORM schema, utility functions
- Depends on: PostgreSQL, Google Calendar API, Stripe, SMTP
- Used by: Frontend, Stripe webhooks
- Purpose: TypeScript type contracts shared between frontend and backend
- Location: `packages/shared/src/types/`
- Contains: `JwtPayload`, `UserRole`, `PaginatedResponse`, `ApiError`, and domain interface types
- Consumed by: Both `@werkstatt/backend` and `@werkstatt/frontend` via npm workspaces

## Data Flow

- `useAuthStore` (Zustand + persist): holds `user` and `isAuthenticated` in `localStorage`; access token intentionally NOT persisted (memory only)
- `useUIStore` (Zustand, no persist): sidebar open/close state
- Server state: All domain data (orders, invoices, customers, etc.) managed by TanStack React Query — no manual caching

## Key Abstractions

- Purpose: Self-contained vertical slice for each domain entity
- Pattern: Each module = `{name}.routes.ts` + `{name}.service.ts` (appointments is the exception: it has a `google-calendar.service.ts` instead of a plain service)
- Examples: `backend/src/modules/orders/`, `backend/src/modules/invoices/`
- Purpose: Contains all business logic and DB queries for a domain; instantiated as a singleton
- Pattern: `export class OrdersService { ... }` then `export const ordersService = new OrdersService();`
- Examples: `backend/src/modules/orders/orders.service.ts`, `backend/src/modules/invoices/invoices.service.ts`
- Purpose: Typed wrappers around `apiClient` for each domain
- Pattern: Flat object with named async functions returning Axios response promises
- Examples: `frontend/src/api/orders.api.ts`, `frontend/src/api/invoices.api.ts`
- Purpose: Top-level route component containing data fetching, list rendering, and dialog state
- Pattern: Co-located with domain-specific dialog/sheet components in the same directory
- Examples: `frontend/src/pages/orders/OrdersPage.tsx` + `OrderDialog.tsx` + `OrderDetailSheet.tsx`
- Purpose: Abstraction layer over Stripe or demo mode
- Interface: `backend/src/modules/payments/payments.provider.ts` — `PaymentProvider` interface
- Implementations: `payments.stripe.ts` and `payments.demo.ts`; selected at runtime by `createPaymentProvider()`

## Entry Points

- Location: `backend/src/server.ts`
- Triggers: `npm run dev` (ts-node-dev) or `node dist/server.js` (production)
- Responsibilities: Loads env, calls `buildApp()`, listens on `PORT`, starts appointment reminder cron
- Location: `backend/src/app.ts`
- Triggers: Called by `server.ts`
- Responsibilities: Registers plugins (cors, helmet, rate-limit, cookies), decorates with `db`, registers all 12 module route groups under `/api/v1/*`, sets global error handler
- Location: `frontend/src/main.tsx`
- Triggers: Vite dev server or static build
- Responsibilities: Mounts React app
- Location: `frontend/src/App.tsx`
- Responsibilities: Wraps app in `QueryClientProvider`, defines all routes, wraps protected routes in `ProtectedRoute`

## Error Handling

- `AppError` class (`backend/src/utils/errors.ts`) carries `statusCode` and `error` label
- `errors.*` factory (`errors.notFound()`, `errors.unauthorized()`, etc.) used throughout service classes
- Zod parse errors are caught and returned as 400 with the parsed Zod message
- Unhandled errors return 500 with the stack in development, generic message in production
- 401 responses trigger automatic token refresh via interceptor; on failure, logout + redirect to `/login`
- React Query `onError` callbacks used per-query for toast notifications

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
