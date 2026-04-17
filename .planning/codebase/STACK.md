# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- TypeScript 5.5.4 — all frontend and backend source code
- SQL — PostgreSQL migrations in `backend/src/db/migrations/`

**Secondary:**
- JavaScript — config files (`tailwind.config.js`, `postcss.config.js`)

## Runtime

**Environment:**
- Node.js (system: v24; no `.nvmrc` pinning detected)

**Package Manager:**
- npm workspaces (monorepo root: `package.json`)
- Lockfile: `package-lock.json` present at root and `backend/`

## Monorepo Structure

Three workspaces defined in root `package.json`:
- `packages/shared` → `@werkstatt/shared` — shared TypeScript types (e.g., `JwtPayload`)
- `backend` → `@werkstatt/backend`
- `frontend` → `@werkstatt/frontend`

## Frameworks

**Backend:**
- Fastify 4.28.1 — HTTP server (`backend/src/server.ts`, `backend/src/app.ts`)
  - `@fastify/cookie` ^9.3.1 — HttpOnly refresh token cookies
  - `@fastify/cors` ^9.0.1 — CORS restricted to `FRONTEND_URL`
  - `@fastify/helmet` ^11.1.1 — security headers
  - `@fastify/rate-limit` ^9.1.0 — 100 req/min global limit
  - `@fastify/multipart` ^8.3.0 — file uploads
  - `@fastify/static` ^7.0.4 — static file serving
  - `@fastify/swagger` ^8.14.0 + `@fastify/swagger-ui` ^4.0.1 — API docs

**Frontend:**
- React 18.3.1 — UI framework (`frontend/src/main.tsx`)
- React Router DOM 6.25.1 — client-side routing
- TanStack React Query 5.51.11 — server state management and caching
- Zustand 4.5.4 — client state (auth store: `frontend/src/store/auth.store.ts`, UI store: `frontend/src/store/ui.store.ts`)

**Build/Dev:**
- Vite 5.3.5 — frontend bundler and dev server (port 5173, proxies `/api` → `http://backend:3000`)
- `@vitejs/plugin-react` ^4.3.1 — React fast refresh
- `ts-node-dev` ^2.0.0 — backend dev server with hot reload
- `tsx` ^4.17.0 — backend scripts (migrations, seeds)

**Testing:**
- Not detected — no test framework or test files found.

## Key Dependencies

**Backend — Critical:**
- `drizzle-orm` ^0.33.0 — type-safe ORM for PostgreSQL
- `drizzle-kit` ^0.24.0 — schema migrations and Drizzle Studio
- `pg` ^8.12.0 — PostgreSQL client (connection pool, max 20 connections)
- `jsonwebtoken` ^9.0.2 — JWT access/refresh token signing and verification
- `bcryptjs` ^2.4.3 — password hashing
- `zod` ^3.23.8 — runtime request validation

**Backend — Features:**
- `googleapis` ^140.0.0 — Google Calendar API v3 integration
- `google-auth-library` ^9.13.0 — Google OAuth2 client
- `stripe` ^20.4.1 — Stripe Checkout (API version `2026-02-25.clover`)
- `nodemailer` ^6.9.14 — SMTP email (appointment reminders, invoice sending)
- `pdfkit` ^0.15.2 — server-side PDF generation for invoices
- `uuid` ^10.0.0 — UUID generation
- `dotenv` ^16.4.5 — environment variable loading
- `fastify-plugin` ^4.5.1 — Fastify plugin decorator utility

**Frontend — Critical:**
- `axios` ^1.7.3 — HTTP client with JWT interceptor and auto-refresh (`frontend/src/api/client.ts`)
- `react-hook-form` ^7.52.1 — form state management
- `@hookform/resolvers` ^3.9.0 — Zod integration for react-hook-form
- `zod` ^3.23.8 — form schema validation

**Frontend — UI:**
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

**Environment (development):**
- Variables injected via `docker-compose.yml`; read in `backend/src/config.ts`
- Sensitive values (JWT secrets, SMTP password, Stripe keys) read from env vars OR Docker secrets files at `/run/secrets/<name>`

**Key env vars (backend):**
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

**Key env vars (frontend):**
- `VITE_API_URL` — API base URL (defaults to `/api/v1`)

**Build:**
- Frontend: `tsc && vite build` → `frontend/dist/`
- Backend: `tsc` → `backend/dist/`
- Shared: `tsc` → `packages/shared/dist/`

## Platform Requirements

**Development:**
- Docker + Docker Compose (all services run via `docker-compose up`)
- Ports: frontend 5273, backend 3009, PostgreSQL 5537

**Production:**
- Docker Compose (`docker-compose.prod.yml`)
- Nginx (Alpine) as reverse proxy with TLS termination via Certbot/Let's Encrypt
- Docker secrets for sensitive values
- Nginx config: `docker/nginx/conf.d/`

---

*Stack analysis: 2026-04-17*
