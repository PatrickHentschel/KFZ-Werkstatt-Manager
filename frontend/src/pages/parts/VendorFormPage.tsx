import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { partsApi } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';

// Rück-Navigation zur Vendors-Tab in der PartsPage
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

export function VendorFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  // Backend hat keinen getById-Endpoint für Vendors — Liste hat ohnehin alle drin
  // und wird vom Cache geteilt (queryKey: ['vendors']).
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

  if (isEdit && isLoadingVendors) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
  }
  if (isEdit && !isLoadingVendors && !existing) {
    return (
      <div className="rounded-md border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
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
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <FormSection title="Stammdaten">
        <div className="space-y-2">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input placeholder="Lieferant GmbH" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Ansprechpartner</Label>
          <Input placeholder="Max Mustermann" {...register('contactPerson')} />
        </div>
      </FormSection>

      <FormSection title="Kontakt">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input type="email" placeholder="info@lieferant.de" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input placeholder="+49 30 1234567" {...register('phone')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Adresse</Label>
          <Input placeholder="Musterstraße 1, Berlin" {...register('address')} />
        </div>
      </FormSection>

      <FormSection title="Notizen">
        <div className="space-y-2">
          <Label>Notizen</Label>
          <Input placeholder="Optionale Notizen" {...register('notes')} />
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
