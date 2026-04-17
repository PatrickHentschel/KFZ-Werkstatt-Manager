# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**Google Calendar API:**
- What it does: Bi-directional sync of workshop appointments with a tenant's Google Calendar
- SDK: `googleapis` ^140.0.0 + `google-auth-library` ^9.13.0
- Auth: OAuth2 authorization code flow — tenant visits `/api/v1/appointments/auth/google/url`, grants consent, callback at `GOOGLE_REDIRECT_URI`
- Scopes: `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/calendar.events`
- Tokens stored: `google_tokens` DB table (access token, refresh token, expiry, calendar ID); auto-refreshed on expiry via `oauth2Client.on('tokens', ...)` event
- Implementation: `backend/src/modules/appointments/google-calendar.service.ts`
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Operations supported: `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `listCalendars`, `setCalendar`, `disconnect`
- Timezone: `Europe/Vienna` hardcoded on all event start/end times

**Stripe (Payments):**
- What it does: Invoice payment checkout — creates Stripe Checkout sessions and handles payment confirmation via webhook
- SDK: `stripe` ^20.4.1 (API version `2026-02-25.clover`)
- Auth: `STRIPE_SECRET_KEY` (secret), `STRIPE_PUBLISHABLE_KEY` (returned to frontend via `GET /api/v1/payments/config`)
- Implementation: `backend/src/modules/payments/payments.stripe.ts` (provider), `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/payments/payments.routes.ts`
- Feature flag: Stripe is optional — falls back to "demo mode" (`payments.demo.ts`) if `STRIPE_SECRET_KEY` is not set; `isStripeEnabled()` in `backend/src/config.ts`
- Payment flow: `POST /api/v1/payments/checkout/:invoiceId` → creates session → redirect → Stripe webhook confirms payment
- Payment methods: card only (`payment_method_types: ['card']`)
- Currency: passed per-invoice in `params.currency`
- Metadata stored on session: `invoiceId`, `tenantId`

## Data Storage

**Primary Database:**
- PostgreSQL 16 (Alpine)
- Docker service name: `db` (dev), `db` (prod)
- Connection: `DATABASE_URL` env var (e.g., `postgresql://werkstatt:changeme_dev@db:5432/werkstattclone`)
- Client: Drizzle ORM with `node-postgres` (`pg`) pool (max 20 connections, 30s idle timeout, 2s connect timeout)
- Schema: `backend/src/db/schema/` — 11 tables: `tenants`, `users`, `customers`, `vehicles`, `orders`, `invoices`, `parts`, `staff`, `appointments`, `google_tokens`, plus `relations.ts`
- Tenant isolation: Per-request PostgreSQL GUC `app.current_tenant_id` set via `set_config(...)` in `backend/src/plugins/auth.ts`; intended to work with Postgres RLS policies
- Migrations: `backend/src/db/migrations/`, applied by `tsx src/db/migrate.ts`
- Seeding: `tsx src/db/seed.ts`

**File Storage — Local:**
- Uploaded files: `/app/uploads` (Docker volume `uploads_data`)
- Generated PDFs: `/app/pdfs` (Docker volume `pdfs_data`)
- No cloud object storage (S3, GCS, etc.) detected

**Caching:**
- None detected — no Redis, Memcached, or in-memory cache layer

## Authentication & Identity

**Auth Provider: Custom (self-hosted JWT)**
- No third-party auth provider (no Auth0, Clerk, Supabase Auth, Firebase, etc.)
- Registration: `POST /api/v1/auth/register` — creates tenant + owner user
- Login: `POST /api/v1/auth/login` — returns short-lived access token + sets HttpOnly refresh token cookie
- Token refresh: `POST /api/v1/auth/refresh` — silent token rotation via `werkstatt_refresh` cookie
- Logout: `POST /api/v1/auth/logout` — clears cookie, invalidates refresh token
- Access token: Bearer JWT, signed with `JWT_ACCESS_SECRET`, expires in 15m (default)
- Refresh token: HttpOnly cookie `werkstatt_refresh`, signed with `JWT_REFRESH_SECRET`, expires in 7d (default)
- Password hashing: `bcryptjs`
- Authorization: role-based via `fastify.requireRole(...roles)` decorator — roles observed: `owner`, `admin`, `staff`
- Implementation: `backend/src/plugins/auth.ts` (Fastify plugin), `backend/src/modules/auth/`

## Email (SMTP)

**Provider: Generic SMTP (Nodemailer)**
- No specific provider locked in — compatible with any SMTP relay (Mailgun, SendGrid, Gmail SMTP, etc.)
- Implementation: `backend/src/utils/email.ts`
- Transport: `nodemailer.createTransport` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- TLS: auto-detected — `secure: true` when port is 465, otherwise STARTTLS on 587
- Env vars: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_FROM`, `SMTP_PASS`
- Feature flag: Email/reminder job only starts if `SMTP_HOST` is set (checked in `backend/src/server.ts`)

**Use cases:**
1. Appointment reminders — background job in `backend/src/jobs/appointmentReminders.ts` runs every 15 minutes, sends German-language reminder emails for appointments 23–25 hours away
2. Invoice delivery — invoice PDF attached and emailed via `backend/src/modules/invoices/invoices.routes.ts` (uses `sendEmail` + `generateInvoicePdf`)

## PDF Generation

- Library: `pdfkit` ^0.15.2 — server-side PDF generation (no external service)
- Implementation: `backend/src/utils/pdf.ts`
- Output: written to `backend/pdfs/` volume; returned as download or emailed as attachment
- Use case: invoice and quote PDF export

## CI/CD & Deployment

**Hosting:**
- Self-hosted via Docker Compose
- Production stack: PostgreSQL, Node.js backend, Nginx (reverse proxy + TLS), Certbot
- TLS: Let's Encrypt via `certbot/certbot` Docker image; auto-renews every 12h
- Nginx config: `docker/nginx/conf.d/`

**CI Pipeline:**
- None detected — no GitHub Actions, GitLab CI, CircleCI, or similar configuration found

**Backups:**
- Optional Docker Compose profile `backup` uses `pg_dump` to `./backups/` directory
- Not automated (must be triggered manually or via cron outside Docker)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/v1/payments/webhook` — Stripe webhook endpoint
  - Verifies signature using `stripe-signature` header + `STRIPE_WEBHOOK_SECRET`
  - Handles event: `checkout.session.completed` → marks invoice as paid
  - No auth middleware — raw buffer content-type parser applied
  - Returns 404 in demo mode (Stripe disabled)

**Outgoing:**
- Google Calendar API calls (create/update/delete events) triggered from appointment CRUD operations
- Stripe Checkout session creation triggered from `POST /api/v1/payments/checkout/:invoiceId`
- SMTP email sending (appointment reminders + invoice delivery)

## Environment Configuration Summary

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Yes | Access token signing |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing |
| `FRONTEND_URL` | Yes (prod) | CORS allow-origin |
| `GOOGLE_CLIENT_ID` | Optional | Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google Calendar OAuth |
| `GOOGLE_REDIRECT_URI` | Optional | Google Calendar OAuth callback |
| `STRIPE_SECRET_KEY` | Optional | Stripe payments (enables Stripe mode) |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook signature verification |
| `STRIPE_PUBLISHABLE_KEY` | Optional | Returned to frontend |
| `SMTP_HOST` | Optional | Email sending (enables reminder job) |
| `SMTP_PORT` | Optional | Default 587 |
| `SMTP_USER` | Optional | SMTP auth username |
| `SMTP_FROM` | Optional | From address |
| `SMTP_PASS` | Optional | SMTP auth password (supports Docker secret) |

**Secrets location (production):**
- `./secrets/jwt_access_secret.txt`
- `./secrets/jwt_refresh_secret.txt`
- `./secrets/smtp_pass.txt`
- Stripe and Google secrets passed as plain env vars (not yet using Docker secrets)

---

*Integration audit: 2026-04-17*
