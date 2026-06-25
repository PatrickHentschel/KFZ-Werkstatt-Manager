import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { CustomerFormPage } from '@/pages/customers/CustomerFormPage';
import { VehiclesPage } from '@/pages/vehicles/VehiclesPage';
import { VehicleFormPage } from '@/pages/vehicles/VehicleFormPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { OrderFormPage } from '@/pages/orders/OrderFormPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { InvoiceFormPage } from '@/pages/invoices/InvoiceFormPage';
import { AppointmentsPage } from '@/pages/appointments/AppointmentsPage';
import { PartsPage } from '@/pages/parts/PartsPage';
import { PartFormPage } from '@/pages/parts/PartFormPage';
import { VendorFormPage } from '@/pages/parts/VendorFormPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Protected routes — ProtectedRoute wraps AppShell which renders <Outlet />
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/new', element: <CustomerFormPage /> },
      { path: 'customers/:id/edit', element: <CustomerFormPage /> },
      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'vehicles/new', element: <VehicleFormPage /> },
      { path: 'vehicles/:id/edit', element: <VehicleFormPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/new', element: <OrderFormPage /> },
      { path: 'orders/:id/edit', element: <OrderFormPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/new', element: <InvoiceFormPage /> },
      { path: 'invoices/:id/edit', element: <InvoiceFormPage /> },
      { path: 'appointments', element: <AppointmentsPage /> },
      { path: 'parts', element: <PartsPage /> },
      { path: 'parts/new', element: <PartFormPage /> },
      { path: 'parts/:id/edit', element: <PartFormPage /> },
      { path: 'parts/vendors/new', element: <VendorFormPage /> },
      { path: 'parts/vendors/:id/edit', element: <VendorFormPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },

  // Fallback — preserved from declarative tree
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
