import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Building2, FileText, Calendar, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { settingsApi } from '@/api/settings.api';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen'),
  email: z.string().email('Ungültige E-Mail'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().length(2, 'Zweistelliger Ländercode (z.B. AT)'),
  taxId: z.string().optional(),
  taxRate: z.number().min(0).max(100),
  invoicePrefix: z.string().max(20),
});

type FormData = z.infer<typeof schema>;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [copiedUri, setCopiedUri] = useState(false);

  const redirectUri = `${window.location.origin}/api/v1/appointments/auth/google/callback`;

  const handleCopyUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const googleMutation = useMutation({
    mutationFn: () => settingsApi.update({
      googleClientId: googleClientId || undefined,
      googleClientSecret: googleClientSecret || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setGoogleClientSecret('');
      toast({ title: 'Google Credentials gespeichert' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'AT', taxRate: 20, invoicePrefix: 'RE' },
  });

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      reset({
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        address: s.address || '',
        city: s.city || '',
        country: s.country || 'AT',
        taxId: s.taxId || '',
        taxRate: Number(s.taxRate),
        invoicePrefix: s.invoicePrefix,
      });
      setGoogleClientId(s.googleClientId || '');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (d: FormData) => settingsApi.update(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Einstellungen gespeichert' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  });

  if (isLoading) return <div className="text-muted-foreground">Wird geladen...</div>;

  const settings = data?.data;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Einstellungen</h1>

      {settings && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Plan:</span>
          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium capitalize">
            {settings.plan}
          </span>
          <span>•</span>
          <span>
            Nächste Rechnungsnummer: {settings.invoicePrefix}-
            {String(settings.invoiceCounter).padStart(5, '0')}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        {/* Workshop profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Werkstattprofil
            </CardTitle>
            <CardDescription>Grundlegende Informationen zu Ihrer Werkstatt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Werkstattname *</Label>
              <Input {...register('name')} placeholder="Muster Werkstatt GmbH" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>E-Mail *</Label>
                <Input type="email" {...register('email')} placeholder="info@werkstatt.at" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...register('phone')} placeholder="+43 1 234 5678" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input {...register('address')} placeholder="Musterstraße 1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Stadt</Label>
                <Input {...register('city')} placeholder="Wien" />
              </div>
              <div className="space-y-2">
                <Label>Land</Label>
                <Input {...register('country')} placeholder="AT" maxLength={2} />
                {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Rechnungseinstellungen
            </CardTitle>
            <CardDescription>UID-Nummer, MwSt-Satz und Rechnungspräfix</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>UID-Nummer (Österreich: ATUxxxxxxxx)</Label>
              <Input {...register('taxId')} placeholder="ATU12345678" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>MwSt-Satz (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  {...register('taxRate', { valueAsNumber: true })}
                />
                {errors.taxRate && (
                  <p className="text-xs text-destructive">{errors.taxRate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Rechnungspräfix</Label>
                <Input {...register('invoicePrefix')} placeholder="RE" maxLength={20} />
                <p className="text-xs text-muted-foreground">Beispiel: RE-00001</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending || !isDirty}>
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </Button>
        </div>
      </form>

      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Google Calendar Integration
          </CardTitle>
          <CardDescription>
            Eigene Google OAuth Credentials für die Kalender-Synchronisierung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Setup instructions */}
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <p className="font-medium">Einrichtung in Google Cloud Console:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Öffne <span className="font-mono text-xs">console.cloud.google.com</span> → APIs &amp; Services → Anmeldedaten</li>
              <li>Erstelle eine OAuth 2.0 Client-ID (Anwendungstyp: Webanwendung)</li>
              <li>Füge folgende URI als autorisierte Weiterleitungs-URI hinzu:</li>
            </ol>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 rounded bg-background border px-3 py-1.5 text-xs font-mono break-all">
                {redirectUri}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyUri} title="Kopieren">
                {copiedUri ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <li className="list-decimal list-inside text-muted-foreground">Kopiere Client-ID und Client-Secret unten</li>
          </div>

          <div className="space-y-2">
            <Label>Client-ID</Label>
            <Input
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="123456789-abc...apps.googleusercontent.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Client-Secret</Label>
            <Input
              type="password"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              placeholder={settings?.googleClientSecretSet ? 'Bereits konfiguriert — neu eingeben zum Ändern' : 'GOCSPX-...'}
            />
          </div>

          <div className="flex items-center justify-between">
            {settings?.googleClientId && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> Credentials konfiguriert
              </span>
            )}
            <Button
              className="ml-auto"
              onClick={() => googleMutation.mutate()}
              disabled={googleMutation.isPending || (!googleClientId && !googleClientSecret)}
            >
              <Save className="mr-2 h-4 w-4" />
              {googleMutation.isPending ? 'Wird gespeichert...' : 'Credentials speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
