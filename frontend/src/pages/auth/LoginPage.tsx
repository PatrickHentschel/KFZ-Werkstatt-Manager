import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wrench, Loader2, Eye, EyeOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  // Login validiert nur auf Vorhandensein — Längenregeln gehören in die Registrierung.
  password: z.string().min(1, 'Passwort erforderlich'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = await authApi.login(data);
      queryClient.clear();
      login(response.data.accessToken, response.data.user as any);
      navigate('/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      const msg = status === 401 || status === 403
        ? 'E-Mail oder Passwort ist falsch. Bitte überprüfen Sie Ihre Zugangsdaten.'
        : 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.';
      setError('root', { message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[5fr_6fr]">
      {/* Brand panel — committed petrol, only on wide screens */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">WerkstattClone</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-balance text-4xl font-bold tracking-tight">
            Die ganze Werkstatt. Ein System.
          </h1>
          <p className="mt-4 text-primary-foreground/80">
            Vom Kunden über den Auftrag bis zur bezahlten Rechnung — und nichts geht
            zwischendurch verloren.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/70">
          Aufträge · Rechnungen · Termine · Lager — an einem Ort.
        </p>

        {/* dezente, industrielle Textur statt Dekor */}
        <Wrench
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 text-primary-foreground/5"
        />
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="rounded-md bg-primary p-2">
              <Wrench className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">WerkstattClone</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Anmelden</h2>
            <p className="text-sm text-muted-foreground">Melden Sie sich in Ihrer Werkstatt an.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="name@werkstatt.de"
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Anmelden
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Noch kein Konto?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Werkstatt registrieren
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
