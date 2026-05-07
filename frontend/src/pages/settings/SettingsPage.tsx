import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Building2, FileText, Wrench, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { settingsApi } from '@/api/settings.api';
import { toast } from '@/hooks/use-toast';

const PLZ_RE = /^[0-9]{5}$/;
const PHONE_RE = /^(\+49|0)[0-9 \-/()]{6,20}$/;
const USTIDNR_RE = /^DE[0-9]{9}$/;
const STEUERNR_RE = /^[0-9]{2,3}[ /]?[0-9]{3}[ /]?[0-9]{4,5}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
// Lightweight IBAN sanity check (length + alphanumeric); full mod-97 happens server-side.
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

const schema = z.object({
  name: z.string().min(2, 'Mindestens 2 Zeichen'),
  email: z.string().email('Ungültige E-Mail'),
  phone: z.string().refine(v => !v || PHONE_RE.test(v), 'Format: +49... oder 0...').optional(),
  address: z.string().optional(),
  postalCode: z.string().refine(v => !v || PLZ_RE.test(v), 'PLZ muss 5 Ziffern enthalten').optional(),
  city: z.string().optional(),
  taxId: z.string().refine(
    v => !v || USTIDNR_RE.test(v.toUpperCase().replace(/\s/g, '')) || STEUERNR_RE.test(v),
    'USt-IdNr. (DE + 9 Ziffern) oder Steuernummer (10-13 Ziffern)',
  ).optional(),
  taxRate: z.number().refine(v => v === 19 || v === 0, 'Nur 19 oder 0'),
  isSmallBusiness: z.boolean(),
  iban: z.string().refine(v => !v || IBAN_RE.test(v.replace(/\s/g, '').toUpperCase()), 'Ungültige IBAN').optional(),
  bic: z.string().refine(v => !v || BIC_RE.test(v.toUpperCase()), 'Ungültige BIC').optional(),
  bankName: z.string().max(255).optional(),
  invoicePrefix: z.string().max(20),
  awMinutes: z.number().int().min(1).max(60),
});

type FormData = z.infer<typeof schema>;

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { taxRate: 19, isSmallBusiness: false, invoicePrefix: 'RE', awMinutes: 5 },
  });

  const isSmallBusiness = watch('isSmallBusiness');

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      reset({
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        address: s.address || '',
        postalCode: s.postalCode || '',
        city: s.city || '',
        taxId: s.taxId || '',
        taxRate: Number(s.taxRate),
        isSmallBusiness: !!s.isSmallBusiness,
        iban: s.iban || '',
        bic: s.bic || '',
        bankName: s.bankName || '',
        invoicePrefix: s.invoicePrefix,
        awMinutes: s.awMinutes ?? 5,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (d: FormData) => settingsApi.update(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Einstellungen gespeichert' });
    },
    onError: (e: any) => toast({
      variant: 'destructive',
      title: 'Fehler beim Speichern',
      description: e?.response?.data?.message,
    }),
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
                <Input type="email" {...register('email')} placeholder="info@werkstatt.de" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input {...register('phone')} placeholder="+49 30 1234567" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Straße + Hausnummer</Label>
              <Input {...register('address')} placeholder="Musterstraße 1" />
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div className="space-y-2">
                <Label>PLZ</Label>
                <Input {...register('postalCode')} placeholder="10115" maxLength={5} />
                {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Stadt</Label>
                <Input {...register('city')} placeholder="Berlin" />
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
            <CardDescription>Steuernummer / USt-IdNr., MwSt-Satz und Rechnungspräfix</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Steuernummer / USt-IdNr.</Label>
              <Input {...register('taxId')} placeholder="DE123456789 oder 12/345/67890" />
              {errors.taxId && <p className="text-xs text-destructive">{errors.taxId.message}</p>}
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                id="isSmallBusiness"
                {...register('isSmallBusiness')}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor="isSmallBusiness" className="cursor-pointer font-medium">
                  Kleinunternehmer (§19 UStG)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Aktiv: Rechnungen ohne Umsatzsteuer-Ausweis, MwSt-Satz wird auf 0 gesetzt.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>MwSt-Satz (%)</Label>
                <Input
                  type="number"
                  step="1"
                  disabled={isSmallBusiness}
                  {...register('taxRate', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  19 (Standard) oder 0 (Kleinunternehmer)
                </p>
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

        {/* Banking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" /> Bankverbindung
            </CardTitle>
            <CardDescription>Wird auf Rechnungen ausgewiesen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input {...register('iban')} placeholder="DE89 3704 0044 0532 0130 00" />
              {errors.iban && <p className="text-xs text-destructive">{errors.iban.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>BIC</Label>
                <Input {...register('bic')} placeholder="COBADEFFXXX" />
                {errors.bic && <p className="text-xs text-destructive">{errors.bic.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Bank</Label>
                <Input {...register('bankName')} placeholder="Commerzbank" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AW settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Arbeitswert (AW)
            </CardTitle>
            <CardDescription>Konfiguration der AW-Einheit für Arbeitspositionen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minuten pro AW</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  className="w-28"
                  {...register('awMinutes', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">Minuten = 1 AW</span>
              </div>
              {errors.awMinutes && <p className="text-xs text-destructive">{errors.awMinutes.message}</p>}
              <p className="text-xs text-muted-foreground">
                Standard laut REFA/VDA: 5 min/AW (= 12 AW/Std). Hersteller wie VW, Audi, BMW verwenden 5 min.
                Einige Werkstätten nutzen 6 min (= 10 AW/Std).
              </p>
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
    </div>
  );
}
