import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';

// ponytail: helper to lazy-load named exports without touching 20+ page files
function lazyNamed<T extends Record<string, React.ComponentType>>(
  factory: () => Promise<T>,
  name: keyof T & string,
) {
  return React.lazy(() => factory().then((m) => ({ default: m[name] })));
}

const LoginPage        = lazyNamed(() => import('@/pages/auth/LoginPage'), 'LoginPage');
const RegisterPage     = lazyNamed(() => import('@/pages/auth/RegisterPage'), 'RegisterPage');
const DashboardPage    = lazyNamed(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage');
const CustomersPage    = lazyNamed(() => import('@/pages/customers/CustomersPage'), 'CustomersPage');
const CustomerFormPage = lazyNamed(() => import('@/pages/customers/CustomerFormPage'), 'CustomerFormPage');
const VehiclesPage     = lazyNamed(() => import('@/pages/vehicles/VehiclesPage'), 'VehiclesPage');
const VehicleFormPage  = lazyNamed(() => import('@/pages/vehicles/VehicleFormPage'), 'VehicleFormPage');
const OrdersPage       = lazyNamed(() => import('@/pages/orders/OrdersPage'), 'OrdersPage');
const OrderFormPage    = lazyNamed(() => import('@/pages/orders/OrderFormPage'), 'OrderFormPage');
const InvoicesPage     = lazyNamed(() => import('@/pages/invoices/InvoicesPage'), 'InvoicesPage');
const InvoiceFormPage  = lazyNamed(() => import('@/pages/invoices/InvoiceFormPage'), 'InvoiceFormPage');
const AppointmentsPage = lazyNamed(() => import('@/pages/appointments/AppointmentsPage'), 'AppointmentsPage');
const PartsPage        = lazyNamed(() => import('@/pages/parts/PartsPage'), 'PartsPage');
const PartFormPage     = lazyNamed(() => import('@/pages/parts/PartFormPage'), 'PartFormPage');
const VendorFormPage   = lazyNamed(() => import('@/pages/parts/VendorFormPage'), 'VendorFormPage');
const StaffPage        = lazyNamed(() => import('@/pages/staff/StaffPage'), 'StaffPage');
const ReportsPage      = lazyNamed(() => import('@/pages/reports/ReportsPage'), 'ReportsPage');
const SettingsPage     = lazyNamed(() => import('@/pages/settings/SettingsPage'), 'SettingsPage');
const NotFoundPage     = lazyNamed(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const router = createBrowserRouter([
  // Public routes — Suspense handled per-route by the fallback below
  {
    path: '/login',
    element: (
      <Suspense>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense>
        <RegisterPage />
      </Suspense>
    ),
  },

  // Protected routes — Suspense lives in AppShell around <Outlet />
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',               element: <DashboardPage /> },
      { path: 'customers',               element: <CustomersPage /> },
      { path: 'customers/new',           element: <CustomerFormPage /> },
      { path: 'customers/:id/edit',      element: <CustomerFormPage /> },
      { path: 'vehicles',                element: <VehiclesPage /> },
      { path: 'vehicles/new',            element: <VehicleFormPage /> },
      { path: 'vehicles/:id/edit',       element: <VehicleFormPage /> },
      { path: 'orders',                  element: <OrdersPage /> },
      { path: 'orders/new',              element: <OrderFormPage /> },
      { path: 'orders/:id/edit',         element: <OrderFormPage /> },
      { path: 'invoices',                element: <InvoicesPage /> },
      { path: 'invoices/new',            element: <InvoiceFormPage /> },
      { path: 'invoices/:id/edit',       element: <InvoiceFormPage /> },
      { path: 'appointments',            element: <AppointmentsPage /> },
      { path: 'parts',                   element: <PartsPage /> },
      { path: 'parts/new',               element: <PartFormPage /> },
      { path: 'parts/:id/edit',          element: <PartFormPage /> },
      { path: 'parts/vendors/new',       element: <VendorFormPage /> },
      { path: 'parts/vendors/:id/edit',  element: <VendorFormPage /> },
      { path: 'staff',                   element: <StaffPage /> },
      { path: 'reports',                 element: <ReportsPage /> },
      { path: 'settings',                element: <SettingsPage /> },
    ],
  },

  { path: '*', element: <Suspense><NotFoundPage /></Suspense> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
      <Toaster />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
