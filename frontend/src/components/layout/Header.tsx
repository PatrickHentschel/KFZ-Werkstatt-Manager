import { Menu, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{user?.email}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{user?.role}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Abmelden">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
