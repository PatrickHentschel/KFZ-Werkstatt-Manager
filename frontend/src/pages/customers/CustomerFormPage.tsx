import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customersApi } from '@/api/customers.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';
import { cn } from '@/lib/utils';

const PLZ_RE = /^[0-9]{5}$/;
const PHONE_RE = /^(\+49|0)[0-9 \-/()]{6,20}$/;
const HOUSE_NR_RE = /^[0-9]{1,5}[a-zA-Z]?(\s?[-/]\s?[0-9]{1,5}[a-zA-Z]?)?$/;

const schema = z.object({
  type: z.enum(['private', 'business']).default('private'),
  salutation: z.enum(['herr', 'frau', 'divers']).optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  birthDate: z.string().optional(),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  phone: z.string().refine((v) => !v || PHONE_RE.test(v), 'Format: +49 30 1234567 oder 030 1234567').optional(),
  street: z.string().optional(),
  houseNumber: z.string().refine((v) => !v || HOUSE_NR_RE.test(v), 'Ungültige Hausnummer (z.B. 12 oder 12a)').optional(),
  city: z.string().optional(),
  postalCode: z.string().refine((v) => !v || PLZ_RE.test(v), 'PLZ muss genau 5 Ziffern enthalten').optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'private' && !data.firstName?.trim() && !data.lastName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bitte mindestens Vor- oder Nachname angeben', path: ['lastName'] });
  }
  if (data.type === 'business' && !data.companyName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Firmenname ist erforderlich', path: ['companyName'] });
  }
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'private' },
    mode: 'onTouched',
  });

  const customerType = watch('type');

  useEffect(() => {
    if (!existing) return;
    reset({
      type: existing.type,
      salutation: existing.salutation || '',
      firstName: existing.firstName || '',
      lastName: existing.lastName || '',
      companyName: existing.companyName || '',
      birthDate: existing.birthDate || '',
      email: existing.email || '',
      phone: existing.phone || '',
      street: existing.street || '',
      houseNumber: existing.houseNumber || '',
      city: existing.city || '',
      postalCode: existing.postalCode || '',
    });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        salutation: data.salutation || null,
        birthDate: data.birthDate || null,
      };
      return isEdit
        ? customersApi.update(id!, payload as any)
        : customersApi.create(payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast({ title: isEdit ? 'Kunde aktualisiert' : 'Kunde erstellt' });
      navigate('/customers');
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Fehler', description: err.response?.data?.message || 'Speichern fehlgeschlagen' });
    },
  });

  const getDisplayName = () => {
    if (!existing) return null;
    return existing.type === 'business'
      ? existing.companyName
      : `${existing.firstName || ''} ${existing.lastName || ''}`.trim();
  };

  if (isEdit && isLoadingExisting) {
    return (
      <ResourceFormLayout
        title="Kunde bearbeiten"
        onCancel={() => navigate('/customers')}
        onSubmit={(e) => e.preventDefault()}
        isSubmitting
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="space-y-2">
              <div className="h-9 rounded bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-9 w-2/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </ResourceFormLayout>
    );
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Kunde bearbeiten' : 'Neuer Kunde'}
      subtitle={isEdit ? getDisplayName() || undefined : undefined}
      onCancel={() => navigate('/customers')}
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <FormSection title="Typ">
        <div className="flex gap-2">
          {(['private', 'business'] as const).map((t) => (
            <label
              key={t}
              className={cn(
                'flex-1 cursor-pointer rounded-md border p-3 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                customerType === t ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              <input type="radio" value={t} {...register('type')} className="sr-only" />
              {t === 'private' ? 'Privatperson' : 'Unternehmen'}
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection title="Stammdaten">
        {customerType === 'business' ? (
          <div className="space-y-2">
            <Label htmlFor="cust-company">Firmenname <span className="text-destructive">*</span></Label>
            <Input id="cust-company" autoComplete="organization" placeholder="Mustermann GmbH" {...register('companyName')} />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="cust-salutation">Anrede</Label>
                <select
                  id="cust-salutation"
                  autoComplete="honorific-prefix"
                  {...register('salutation')}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— bitte wählen —</option>
                  <option value="herr">Herr</option>
                  <option value="frau">Frau</option>
                  <option value="divers">Divers</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-firstName">Vorname</Label>
                <Input id="cust-firstName" autoComplete="given-name" placeholder="Max" {...register('firstName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cust-lastName">Nachname <span className="text-destructive">*</span></Label>
                <Input id="cust-lastName" autoComplete="family-name" placeholder="Mustermann" {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-birthDate">Geburtsdatum</Label>
              <Input id="cust-birthDate" type="date" autoComplete="bday" max={new Date().toISOString().split('T')[0]} {...register('birthDate')} className="w-48" />
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Kontakt">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cust-email">E-Mail</Label>
            <Input id="cust-email" type="email" autoComplete="email" placeholder="max@example.de" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-phone">Telefon</Label>
            <Input id="cust-phone" type="tel" autoComplete="tel" placeholder="+49 30 1234567" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Adresse">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label htmlFor="cust-street">Straße</Label>
            <Input id="cust-street" autoComplete="address-line1" placeholder="Musterstraße" {...register('street')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-houseNumber">Hausnummer</Label>
            <Input id="cust-houseNumber" autoComplete="address-line2" placeholder="12a" {...register('houseNumber')} />
            {errors.houseNumber && (
              <p className="text-xs text-destructive">{errors.houseNumber.message}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cust-postalCode">PLZ</Label>
            <Input id="cust-postalCode" autoComplete="postal-code" inputMode="numeric" placeholder="10115" maxLength={5} {...register('postalCode')} />
            {errors.postalCode && (
              <p className="text-xs text-destructive">{errors.postalCode.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="cust-city">Stadt</Label>
            <Input id="cust-city" autoComplete="address-level2" placeholder="Berlin" {...register('city')} />
          </div>
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
