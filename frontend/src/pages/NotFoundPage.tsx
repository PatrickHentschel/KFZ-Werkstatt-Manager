import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl font-bold text-muted-foreground/30">404</p>
      <p className="text-lg font-semibold">Seite nicht gefunden</p>
      <p className="text-sm text-muted-foreground">
        Diese Adresse existiert nicht. Möglicherweise wurde der Link geändert oder gelöscht.
      </p>
      <Button variant="outline" onClick={() => navigate('/dashboard')}>
        Zum Dashboard
      </Button>
    </div>
  );
}
