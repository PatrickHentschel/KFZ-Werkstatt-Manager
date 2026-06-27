import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { partsApi } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';

const VENDORS_TAB_URL = '/parts?tab=vendors';

const schema = z.object({
  name: z.string().min(1, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function VendorFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
        <div className="h-10 w-full rounded-md bg-muted" />
        <div className="h-20 w-full rounded-md bg-muted" />
      </div>
    </div>
  );
}

export function VendorFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  // Backend hat keinen getById-Endpoint für Vendors — Liste hat ohnehin alle drin
  const { data: vendorsData, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => partsApi.listVendors(),
    enabled: isEdit,
  });

  const existing = isEdit
    ? vendorsData?.data?.data?.find((v) => v.id === id)
    : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', address: '', contactPerson: '', notes: '' },
  });

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      email: existing.email ?? '',
      phone: existing.phone ?? '',
      address: existing.address ?? '',
      contactPerson: existing.contactPerson ?? '',
      notes: existing.notes ?? '',
    });
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        contactPerson: data.contactPerson || undefined,
        notes: data.notes || undefined,
      };
      return isEdit ? partsApi.updateVendor(id!, payload) : partsApi.createVendor(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: isEdit ? 'Lieferant aktualisiert' : 'Lieferant erstellt' });
      navigate(VENDORS_TAB_URL);
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Speichern fehlgeschlagen',
      });
    },
  });

  const submitHandler = handleSubmit((d) => mutation.mutate(d));

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        submitHandler();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [submitHandler]);

  if (isEdit && isLoadingVendors) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 pb-4 border-b mb-6">
          <div className="h-9 w-9 rounded bg-muted animate-pulse" />
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 mx-auto w-full max-w-4xl">
          <VendorFormSkeleton />
        </div>
      </div>
    );
  }

  if (isEdit && !isLoadingVendors && !existing) {
    return (
      <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
        <p className="mb-3">Lieferant nicht gefunden.</p>
        <Button variant="outline" onClick={() => navigate(VENDORS_TAB_URL)}>Zurück</Button>
      </div>
    );
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
      subtitle={existing?.name || undefined}
      onCancel={() => navigate(VENDORS_TAB_URL)}
      onSubmit={submitHandler}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <FormSection title="Stammdaten">
        <div className="space-y-2">
          <Label htmlFor="vendor-name">
            Name <span className="text-destructive" aria-hidden>*</span>
          </Label>
          <Input
            id="vendor-name"
            placeholder="Lieferant GmbH"
            aria-required="true"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-destructive" role="alert">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor-contact-person">Ansprechpartner</Label>
          <Input
            id="vendor-contact-person"
            placeholder="Max Mustermann"
            {...register('contactPerson')}
          />
        </div>
      </FormSection>

      <FormSection title="Kontakt">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vendor-email">E-Mail</Label>
            <Input
              id="vendor-email"
              type="email"
              placeholder="info@lieferant.de"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-phone">Telefon</Label>
            <Input
              id="vendor-phone"
              placeholder="+49 30 1234567"
              {...register('phone')}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor-address">Adresse</Label>
          <Input
            id="vendor-address"
            placeholder="Musterstraße 1, 10115 Berlin"
            {...register('address')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor-notes">Notizen</Label>
          <Textarea
            id="vendor-notes"
            placeholder="Zahlungskonditionen, Lieferzeiten, Besonderheiten …"
            rows={3}
            {...register('notes')}
          />
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
