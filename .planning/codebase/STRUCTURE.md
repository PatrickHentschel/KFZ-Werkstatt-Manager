# Directory Structure

## Root
```
WerkstattClone/
├── backend/          # Fastify API server
├── frontend/         # React SPA
├── packages/shared/  # Shared TypeScript types
├── package.json      # npm workspaces root
├── .env / .env.example
└── secrets/          # SSL/TLS certs (gitignored content)
```

## Backend (`backend/src/`)
```
backend/src/
├── app.ts                    # Fastify app factory, plugin registration, rate limiting
├── config.ts                 # Env config (JWT secret, DB URL, etc.)
├── db/
│   ├── index.ts              # Drizzle pg pool setup
│   ├── migrate.ts            # Migration runner
│   ├── seed.ts               # Dev seed data
│   ├── schema/               # Drizzle table definitions (one file per entity)
│   │   ├── index.ts          # Re-exports all schemas
│   │   ├── appointments.ts
│   │   ├── customers.ts
│   │   ├── google_tokens.ts
│   │   ├── invoices.ts
│   │   ├── orders.ts
│   │   ├── parts.ts
│   │   ├── staff.ts
│   │   ├── tenants.ts
│   │   ├── users.ts
│   │   ├── vehicles.ts
│   │   └── relations.ts      # Drizzle relation definitions
│   └── migrations/           # SQL migration files (Drizzle-generated)
├── jobs/
│   └── appointmentReminders.ts  # Cron job: email reminders
├── modules/                  # Feature modules (routes + service per feature)
│   ├── appointments/
│   │   ├── appointments.routes.ts
│   │   └── google-calendar.service.ts
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   └── auth.service.ts
│   ├── customers/
│   ├── dashboard/
│   ├── invoices/
│   ├── orders/
│   ├── parts/
│   ├── payments/
│   │   ├── payments.routes.ts
│   │   ├── payments.service.ts
│   │   ├── payments.provider.ts   # Provider interface
│   │   ├── payments.stripe.ts     # Stripe implementation
│   │   └── payments.demo.ts       # Demo/fallback implementation
│   ├── reports/
│   ├── staff/
│   ├── tenants/
│   └── vehicles/
├── plugins/                  # Fastify plugins
│   └── auth.ts               # JWT auth plugin (decorates request with tenant)
└── utils/
    └── pdf.ts                # PDF generation (invoice PDFs)
```

## Frontend (`frontend/src/`)
```
frontend/src/
├── main.tsx                  # React entry, QueryClient setup
├── App.tsx                   # Router, route definitions
├── index.css                 # Tailwind base styles
├── api/                      # API client modules (one per entity)
│   ├── client.ts             # Axios instance, interceptors, token refresh
│   ├── auth.api.ts
│   ├── customers.api.ts
│   ├── dashboard.api.ts
│   ├── invoices.api.ts
│   ├── orders.api.ts
│   ├── parts.api.ts
│   ├── payments.api.ts
│   ├── reports.api.ts
│   ├── settings.api.ts
│   ├── staff.api.ts
│   └── vehicles.api.ts
├── components/
│   ├── layout/               # App shell, header, sidebar
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── shared/
│   │   └── ProtectedRoute.tsx
│   └── ui/                   # Radix UI primitives (shadcn-style)
│       ├── badge.tsx, button.tsx, card.tsx, input.tsx, label.tsx
│       ├── separator.tsx, toast.tsx, toaster.tsx
├── hooks/
│   └── use-toast.ts
├── lib/
│   └── utils.ts              # cn() utility (clsx + tailwind-merge)
├── pages/                    # Feature pages (one dir per feature)
│   ├── appointments/         # AppointmentsPage + EventDialog
│   ├── auth/                 # LoginPage, RegisterPage
│   ├── customers/            # CustomersPage + CustomerDialog
│   ├── dashboard/            # DashboardPage
│   ├── invoices/             # InvoicesPage + InvoiceDialog
│   ├── orders/               # OrdersPage + OrderDialog + OrderDetailSheet
│   ├── parts/                # PartsPage + PartDialog
│   ├── payments/             # DemoCheckoutPage + PaymentSuccessPage
│   ├── reports/              # ReportsPage
│   ├── settings/             # SettingsPage
│   ├── staff/                # StaffPage + StaffDialog
│   └── vehicles/             # VehiclesPage + VehicleDialog
└── store/
    ├── auth.store.ts         # Zustand: user, tokens, login/logout
    └── ui.store.ts           # Zustand: sidebar collapse state
```

## Shared Package (`packages/shared/src/types/`)
One type file per entity: `appointment.ts`, `auth.ts`, `common.ts`, `customer.ts`, `invoice.ts`, `order.ts`, `parts.ts`, `payment.ts`, `staff.ts`, `tenant.ts`, `vehicle.ts`

## Where to Add New Code
- New entity: `backend/src/db/schema/entity.ts` + `backend/src/modules/entity/` + `frontend/src/api/entity.api.ts` + `frontend/src/pages/entity/`
- New shared type: `packages/shared/src/types/entity.ts` + export from `packages/shared/src/index.ts`
- New migration: run `drizzle-kit generate` from `backend/`
- New background job: `backend/src/jobs/`
