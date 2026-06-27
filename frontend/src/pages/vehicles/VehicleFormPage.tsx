import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
  licensePlate: z.string().min(1, 'Kennzeichen ist erforderlich (z.B. B-AB 1234)'),
  make: z.string().min(1, 'Marke ist erforderlich (z.B. VW, BMW)'),
  model: z.string().min(1, 'Modell ist erforderlich (z.B. Golf, 3er)'),
  vin: z.string().optional().refine((v) => !v || v.length === 17, 'FIN muss genau 17 Zeichen haben'),
  hsn: z.string().optional().refine((v) => !v || HSN_RE.test(v), 'HSN: genau 4 Ziffern (z.B. 0603)'),
  tsn: z.string().optional().refine((v) => !v || TSN_RE.test(v.toUpperCase()), 'TSN: 3 Zeichen (Ziffern/Buchstaben, z.B. AUC)'),
  firstRegistration: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  mileage: z.preprocess(nanToUndefined, z.number({ required_error: 'Kilometerstand ist erforderlich', invalid_type_error: 'Bitte eine gültige Zahl eingeben' }).int('Nur ganze Zahlen').nonnegative('Kilometerstand kann nicht negativ sein')),
  nextTuvDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function getCustomerName(c: Customer): string {
  return c.type === 'business'
    ? c.companyName || '—'
    : `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
}

function VehicleFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      {/* Kunde */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-20 rounded bg-muted" />
        <div className="h-10 w-full rounded-md bg-muted" />
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
      {/* Stammdaten */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md bg-muted" />)}
        </div>
      </div>
      {/* Identifikation + Stand */}
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((j) => <div key={j} className="h-10 rounded-md bg-muted" />)}
          </div>
        </div>
      ))}
    </div>
  );
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
    mode: 'onTouched',
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

  const submitHandler = handleSubmit((d) => mutation.mutate(d));

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
      return isEdit ? vehiclesApi.update(id!, payload) : vehiclesApi.create(payload);
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
    return (
      <div className="flex flex-col min-h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 pb-4 border-b mb-6">
          <div className="h-9 w-9 rounded bg-muted animate-pulse" />
          <div className="h-7 w-56 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 mx-auto w-full max-w-4xl">
          <VehicleFormSkeleton />
        </div>
      </div>
    );
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
      subtitle={isEdit && existing ? `${existing.licensePlate} · ${existing.make} ${existing.model}` : undefined}
      onCancel={() => navigate('/vehicles')}
      onSubmit={submitHandler}
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            id="customer-search"
            aria-label="Kunden suchen"
            placeholder="Kunden suchen..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div
          role="group"
          aria-label="Kundenliste"
          className="space-y-1 max-h-96 overflow-y-auto rounded-md border"
        >
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Kunden gefunden</p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={selectedCustomerId === c.id}
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
        {errors.customerId && (
          <p className="text-xs text-destructive" role="alert">{errors.customerId.message}</p>
        )}
      </FormSection>

      <FormSection title="Stammdaten">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="vehicle-license-plate">
              Kennzeichen <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vehicle-license-plate"
              placeholder="B-AB 1234"
              className="font-mono uppercase"
              aria-required="true"
              aria-invalid={!!errors.licensePlate}
              {...register('licensePlate')}
            />
            {errors.licensePlate && (
              <p className="text-xs text-destructive" role="alert">{errors.licensePlate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-make">
              Marke <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vehicle-make"
              placeholder="VW"
              aria-required="true"
              aria-invalid={!!errors.make}
              {...register('make')}
            />
            {errors.make && (
              <p className="text-xs text-destructive" role="alert">{errors.make.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-model">
              Modell <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vehicle-model"
              placeholder="Golf"
              aria-required="true"
              aria-invalid={!!errors.model}
              {...register('model')}
            />
            {errors.model && (
              <p className="text-xs text-destructive" role="alert">{errors.model.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Identifikation"
        description="HSN/TSN aus dem Fahrzeugschein (Felder 2.1 / 2.2)"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[100px_100px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="vehicle-hsn">HSN</Label>
            <Input
              id="vehicle-hsn"
              placeholder="0603"
              maxLength={4}
              aria-invalid={!!errors.hsn}
              {...register('hsn')}
            />
            {errors.hsn && (
              <p className="text-xs text-destructive" role="alert">{errors.hsn.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-tsn">TSN</Label>
            <Input
              id="vehicle-tsn"
              placeholder="AUC"
              maxLength={3}
              className="uppercase"
              aria-invalid={!!errors.tsn}
              {...register('tsn')}
            />
            {errors.tsn && (
              <p className="text-xs text-destructive" role="alert">{errors.tsn.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-vin">FIN / VIN</Label>
            <div className="relative">
              <Input
                id="vehicle-vin"
                placeholder="WVWZZZ1KZAW123456"
                className="font-mono uppercase pr-14"
                maxLength={17}
                aria-invalid={!!errors.vin}
                aria-describedby={vinValue.length > 0 ? 'vin-counter' : undefined}
                {...register('vin')}
              />
              {vinValue.length === 17 ? (
                <CheckCircle2
                  id="vin-counter"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success pointer-events-none"
                  aria-label="FIN vollständig"
                />
              ) : vinValue.length > 0 ? (
                <span
                  id="vin-counter"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums pointer-events-none"
                  aria-live="polite"
                >
                  {vinValue.length}/17
                </span>
              ) : null}
            </div>
            {errors.vin && (
              <p className="text-xs text-destructive" role="alert">{errors.vin.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Kilometerstand & Prüfung">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="vehicle-mileage">
              Kilometerstand <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vehicle-mileage"
              type="number"
              placeholder="125000"
              min={0}
              aria-required="true"
              aria-invalid={!!errors.mileage}
              {...register('mileage', { valueAsNumber: true })}
            />
            {errors.mileage && (
              <p className="text-xs text-destructive" role="alert">{errors.mileage.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-first-registration">Erstzulassung</Label>
            <Input id="vehicle-first-registration" type="date" {...register('firstRegistration')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-next-tuv">Nächste HU / AU</Label>
            <Input id="vehicle-next-tuv" type="date" {...register('nextTuvDate')} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Ausstattung">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="vehicle-color">Farbe</Label>
            <Input id="vehicle-color" placeholder="Silber" {...register('color')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-fuel-type">Kraftstoff</Label>
            <Select id="vehicle-fuel-type" {...register('fuelType')}>
              <option value="">— bitte wählen —</option>
              <option value="benzin">Benzin</option>
              <option value="diesel">Diesel</option>
              <option value="elektro">Elektro</option>
              <option value="hybrid">Hybrid</option>
              <option value="lpg">LPG / Autogas</option>
              <option value="cng">CNG / Erdgas</option>
              <option value="sonstige">Sonstige</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-transmission">Getriebe</Label>
            <Select id="vehicle-transmission" {...register('transmission')}>
              <option value="">— bitte wählen —</option>
              <option value="manual">Schaltgetriebe</option>
              <option value="automatic">Automatik</option>
              <option value="semi_automatic">Halbautomatik / DSG</option>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle-notes">Notizen</Label>
          <Textarea
            id="vehicle-notes"
            placeholder="Reifengröße, Besonderheiten, Kundenhinweise …"
            rows={3}
            {...register('notes')}
          />
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
