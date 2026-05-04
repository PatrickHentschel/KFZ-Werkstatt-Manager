import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { VehiclesPage } from '@/pages/vehicles/VehiclesPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { AppointmentsPage } from '@/pages/appointments/AppointmentsPage';
import { PartsPage } from '@/pages/parts/PartsPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { DemoCheckoutPage } from '@/pages/payments/DemoCheckoutPage';
import { PaymentSuccessPage } from '@/pages/payments/PaymentSuccessPage';

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
  { path: '/demo-checkout', element: <DemoCheckoutPage /> },

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
      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'appointments', element: <AppointmentsPage /> },
      { path: 'parts', element: <PartsPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'payment-success', element: <PaymentSuccessPage /> },
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
