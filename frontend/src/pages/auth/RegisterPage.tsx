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
import { toast } from '@/hooks/use-toast';

const registerSchema = z.object({
  workshopName: z.string().min(2, 'Mindestens 2 Zeichen'),
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(8, 'Mindestens 8 Zeichen'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const response = await authApi.register({
        workshopName: data.workshopName,
        email: data.email,
        password: data.password,
      });
      queryClient.clear();
      login(response.data.accessToken, response.data.user as any);
      navigate('/dashboard');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Registrierung fehlgeschlagen',
        description: err.response?.data?.message || 'Ein Fehler ist aufgetreten',
      });
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
            <h2 className="text-2xl font-bold tracking-tight">Konto erstellen</h2>
            <p className="text-sm text-muted-foreground">Erstellen Sie Ihr Werkstattkonto.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workshopName">Werkstattname</Label>
              <Input
                id="workshopName"
                autoComplete="organization"
                autoFocus
                placeholder="Muster Werkstatt GmbH"
                {...register('workshopName')}
              />
              {errors.workshopName && <p className="text-sm text-destructive">{errors.workshopName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="info@werkstatt.de"
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
                  autoComplete="new-password"
                  placeholder="Mindestens 8 Zeichen"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Passwort wiederholen"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Registrieren
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Bereits ein Konto?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Anmelden</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
