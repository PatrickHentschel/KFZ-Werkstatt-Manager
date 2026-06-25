import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { vehiclesApi } from '@/api/vehicles.api';
import { customersApi, type Customer } from '@/api/customers.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';
import { cn } from '@/lib/utils';

const HSN_RE = /^[0-9]{4}$/;
const TSN_RE = /^[A-Z0-9]{3}$/;

const nanToUndefined = (v: unknown) => (typeof v === 'number' && isNaN(v) ? undefined : v);

const schema = z.object({
  customerId: z.string().min(1, 'Bitte einen Kunden auswählen'),
  licensePlate: z.string().min(1, 'Pflichtfeld'),
  make: z.string().min(1, 'Pflichtfeld'),
  model: z.string().min(1, 'Pflichtfeld'),
  vin: z.string().optional().refine((v) => !v || v.length === 17, 'FIN muss 17 Zeichen haben'),
  hsn: z.string().optional().refine((v) => !v || HSN_RE.test(v), 'HSN: 4 Ziffern'),
  tsn: z.string().optional().refine((v) => !v || TSN_RE.test(v.toUpperCase()), 'TSN: 3 alphanumerisch'),
  firstRegistration: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  mileage: z.preprocess(nanToUndefined, z.number({ required_error: 'Pflichtfeld' }).int().nonnegative()),
  nextTuvDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function getCustomerName(c: Customer): string {
  return c.type === 'business'
    ? c.companyName || '—'
    : `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
}

export function VehicleFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => vehiclesApi.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: '' },
  });

  const selectedCustomerId = watch('customerId');
  const vinValue = watch('vin') ?? '';

  useEffect(() => {
    if (!existing) return;
    reset({
      customerId: existing.customerId,
      licensePlate: existing.licensePlate,
      make: existing.make,
      model: existing.model,
      vin: existing.vin || '',
      hsn: existing.hsn || '',
      tsn: existing.tsn || '',
      firstRegistration: existing.firstRegistration || '',
      color: existing.color || '',
      fuelType: existing.fuelType || '',
      transmission: existing.transmission || '',
      mileage: existing.mileage ?? 0,
      nextTuvDate: existing.nextTuvDate || '',
      notes: existing.notes || '',
    });
  }, [existing, reset]);

  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 50, search: customerSearch || undefined }),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        vin: data.vin || undefined,
        hsn: data.hsn || undefined,
        tsn: data.tsn ? data.tsn.toUpperCase() : undefined,
        firstRegistration: data.firstRegistration || undefined,
        fuelType: data.fuelType || undefined,
        transmission: data.transmission || undefined,
        nextTuvDate: data.nextTuvDate || undefined,
      };
      return isEdit
        ? vehiclesApi.update(id!, payload)
        : vehiclesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
      toast({ title: isEdit ? 'Fahrzeug aktualisiert' : 'Fahrzeug erstellt' });
      navigate('/vehicles');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || err.message,
      });
    },
  });

  const customers = customersData?.data.data ?? [];
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (isEdit && isLoadingExisting) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
      subtitle={isEdit && existing ? `${existing.licensePlate} · ${existing.make} ${existing.model}` : undefined}
      onCancel={() => navigate('/vehicles')}
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <FormSection title="Kunde" description="Halter des Fahrzeugs">
        {selectedCustomer && (
          <div className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium text-primary">{getCustomerName(selectedCustomer)}</span>
            {(selectedCustomer.email || selectedCustomer.phone || selectedCustomer.city) && (
              <span className="ml-2 text-xs text-muted-foreground">
                {selectedCustomer.email || selectedCustomer.phone || selectedCustomer.city}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kunden suchen..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto rounded-md border">
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Kunden gefunden</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm border-b last:border-b-0',
                  selectedCustomerId === c.id && 'bg-primary/5 text-primary font-medium',
                )}
                onClick={() => setValue('customerId', c.id, { shouldDirty: true, shouldValidate: true })}
              >
                <div className="flex items-baseline gap-3">
                  <span className="flex-1 truncate">{getCustomerName(c)}</span>
                  {(c.email || c.phone || c.city) && (
                    <span className="text-xs text-muted-foreground font-normal truncate">
                      {c.email || c.phone || c.city}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
      </FormSection>

      <FormSection title="Stammdaten">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Kennzeichen <span className="text-destructive">*</span></Label>
            <Input placeholder="B-AB 1234" className="font-mono uppercase" {...register('licensePlate')} />
            {errors.licensePlate && <p className="text-xs text-destructive">{errors.licensePlate.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Marke <span className="text-destructive">*</span></Label>
            <Input placeholder="VW" {...register('make')} />
            {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Modell <span className="text-destructive">*</span></Label>
            <Input placeholder="Golf" {...register('model')} />
            {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Identifikation"
        description="HSN/TSN aus dem Fahrzeugschein (Felder 2.1 / 2.2)"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[100px_100px_1fr]">
          <div className="space-y-2">
            <Label>HSN</Label>
            <Input placeholder="0603" maxLength={4} {...register('hsn')} />
            {errors.hsn && <p className="text-xs text-destructive">{errors.hsn.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>TSN</Label>
            <Input placeholder="AUC" maxLength={3} className="uppercase" {...register('tsn')} />
            {errors.tsn && <p className="text-xs text-destructive">{errors.tsn.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>FIN / VIN</Label>
            <div className="relative">
              <Input
                placeholder="WVWZZZ1KZAW123456"
                className="font-mono uppercase pr-14"
                maxLength={17}
                {...register('vin')}
              />
              {vinValue.length > 0 && vinValue.length < 17 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums pointer-events-none">
                  {vinValue.length}/17
                </span>
              )}
            </div>
            {errors.vin && <p className="text-xs text-destructive">{errors.vin.message}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Stand & HU">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Kilometerstand <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              placeholder="125000"
              min={0}
              {...register('mileage', { valueAsNumber: true })}
            />
            {errors.mileage && <p className="text-xs text-destructive">{errors.mileage.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Erstzulassung</Label>
            <Input type="date" {...register('firstRegistration')} />
          </div>
          <div className="space-y-2">
            <Label>Nächste HU / AU</Label>
            <Input type="date" {...register('nextTuvDate')} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Sonstiges">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Farbe</Label>
            <Input placeholder="Silber" {...register('color')} />
          </div>
          <div className="space-y-2">
            <Label>Kraftstoff</Label>
            <select
              {...register('fuelType')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— bitte wählen —</option>
              <option value="benzin">Benzin</option>
              <option value="diesel">Diesel</option>
              <option value="elektro">Elektro</option>
              <option value="hybrid">Hybrid</option>
              <option value="lpg">LPG / Autogas</option>
              <option value="cng">CNG / Erdgas</option>
              <option value="sonstige">Sonstige</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Getriebe</Label>
            <select
              {...register('transmission')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— bitte wählen —</option>
              <option value="manual">Schaltgetriebe</option>
              <option value="automatic">Automatik</option>
              <option value="semi_automatic">Halbautomatik / DSG</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notizen</Label>
          <Input placeholder="Interne Notizen..." {...register('notes')} />
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
