import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Car, ClipboardList, FileText,
  Calendar, Package, UserCog, BarChart3, Settings, Wrench
} from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/customers', icon: Users, label: 'Kunden' },
  { href: '/vehicles', icon: Car, label: 'Fahrzeuge' },
  { href: '/orders', icon: ClipboardList, label: 'Aufträge' },
  { href: '/invoices', icon: FileText, label: 'Rechnungen' },
  { href: '/appointments', icon: Calendar, label: 'Termine' },
  { href: '/parts', icon: Package, label: 'Teile' },
  { href: '/staff', icon: UserCog, label: 'Mitarbeiter' },
  { href: '/reports', icon: BarChart3, label: 'Berichte' },
  { href: '/settings', icon: Settings, label: 'Einstellungen' },
];

export function Sidebar() {
  const { sidebarOpen } = useUIStore();
  const location = useLocation();

  return (
    <div className={cn(
      'fixed left-0 top-0 z-50 h-full bg-gray-900 text-white transition-all duration-300',
      sidebarOpen ? 'w-64' : 'w-16'
    )}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-700 px-4">
        <Wrench className="h-8 w-8 shrink-0 text-blue-400" />
        {sidebarOpen && (
          <span className="text-lg font-bold">WerkstattClone</span>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-4 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
