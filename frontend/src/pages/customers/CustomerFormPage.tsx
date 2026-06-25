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
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().refine((v) => !v || PHONE_RE.test(v), 'Format: +49... oder 0...').optional(),
  street: z.string().optional(),
  houseNumber: z.string().refine((v) => !v || HOUSE_NR_RE.test(v), 'Ungültige Hausnummer').optional(),
  city: z.string().optional(),
  postalCode: z.string().refine((v) => !v || PLZ_RE.test(v), 'PLZ muss 5 Ziffern enthalten').optional(),
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
      toast({ variant: 'destructive', title: 'Fehler', description: err.response?.data?.message });
    },
  });

  const getDisplayName = () => {
    if (!existing) return null;
    return existing.type === 'business'
      ? existing.companyName
      : `${existing.firstName || ''} ${existing.lastName || ''}`.trim();
  };

  if (isEdit && isLoadingExisting) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
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
                'flex-1 cursor-pointer rounded-md border p-3 text-center text-sm transition-colors',
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
            <Label>Firmenname</Label>
            <Input placeholder="Mustermann GmbH" {...register('companyName')} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr_1fr]">
              <div className="space-y-2">
                <Label>Anrede</Label>
                <select
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
                <Label>Vorname</Label>
                <Input placeholder="Max" {...register('firstName')} />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input placeholder="Mustermann" {...register('lastName')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Geburtsdatum</Label>
              <Input type="date" {...register('birthDate')} className="w-48" />
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Kontakt">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input type="email" placeholder="max@example.de" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input placeholder="+49 30 1234567" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Adresse">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label>Straße</Label>
            <Input placeholder="Musterstraße" {...register('street')} />
          </div>
          <div className="space-y-2">
            <Label>Hausnummer</Label>
            <Input placeholder="12a" {...register('houseNumber')} />
            {errors.houseNumber && (
              <p className="text-xs text-destructive">{errors.houseNumber.message}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>PLZ</Label>
            <Input placeholder="10115" maxLength={5} {...register('postalCode')} />
            {errors.postalCode && (
              <p className="text-xs text-destructive">{errors.postalCode.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Stadt</Label>
            <Input placeholder="Berlin" {...register('city')} />
          </div>
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
