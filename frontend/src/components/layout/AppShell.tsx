import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '@/store/ui.store';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export function AppShell() {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Suspense>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
