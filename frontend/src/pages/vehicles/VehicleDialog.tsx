import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api';
import { customersApi, type Customer } from '@/api/customers.api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const HSN_RE = /^[0-9]{4}$/;
const TSN_RE = /^[A-Z0-9]{3}$/;

const nanToUndefined = (v: unknown) =>
  typeof v === 'number' && isNaN(v) ? undefined : v;

const schema = z.object({
  licensePlate: z.string().min(1, 'Pflichtfeld'),
  make: z.string().min(1, 'Pflichtfeld'),
  model: z.string().min(1, 'Pflichtfeld'),
  vin: z.string().optional().refine(v => !v || v.length === 17, 'FIN muss 17 Zeichen haben'),
  hsn: z.string().optional().refine(v => !v || HSN_RE.test(v), 'HSN: 4 Ziffern'),
  tsn: z.string().optional().refine(v => !v || TSN_RE.test(v.toUpperCase()), 'TSN: 3 alphanumerisch'),
  firstRegistration: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  // KM-Stand: Pflicht
  mileage: z.preprocess(nanToUndefined, z.number({ required_error: 'Pflichtfeld' }).int().nonnegative()),
  nextTuvDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Vehicle;
}

function getCustomerName(c: Customer): string {
  return c.type === 'business'
    ? c.companyName || '—'
    : `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
}

export function VehicleDialog({ open, onClose, initialData }: Props) {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && initialData) {
      setSelectedCustomerId(initialData.customerId);
      reset({
        licensePlate: initialData.licensePlate,
        make: initialData.make,
        model: initialData.model,
        vin: initialData.vin || '',
        hsn: initialData.hsn || '',
        tsn: initialData.tsn || '',
        firstRegistration: initialData.firstRegistration || '',
        color: initialData.color || '',
        fuelType: initialData.fuelType || '',
        transmission: initialData.transmission || '',
        mileage: initialData.mileage ?? 0,
        nextTuvDate: initialData.nextTuvDate || '',
        notes: initialData.notes || '',
      });
    } else if (!open) {
      setCustomerSearch('');
      setSelectedCustomerId(null);
      reset({
        licensePlate: '',
        make: '',
        model: '',
        vin: '',
        hsn: '',
        tsn: '',
        firstRegistration: '',
        color: '',
        fuelType: '',
        transmission: '',
        mileage: undefined as any,
        nextTuvDate: '',
        notes: '',
      });
    }
  }, [open, initialData, reset]);

  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 20, search: customerSearch || undefined }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!selectedCustomerId) throw new Error('Kein Kunde ausgewählt');
      // Normalize: HSN/TSN uppercase, leere strings → undefined
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
      return initialData
        ? vehiclesApi.update(initialData.id, payload)
        : vehiclesApi.create({ ...payload, customerId: selectedCustomerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: initialData ? 'Fahrzeug aktualisiert' : 'Fahrzeug erstellt' });
      onClose();
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

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg flex flex-col max-h-[85vh]">

          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <Dialog.Title className="text-lg font-semibold">
              {initialData ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          <form
            id="vehicle-form"
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            className="overflow-y-auto flex-1"
          >
            <div className="p-6 space-y-5">

              {/* Customer selection */}
              <div className="space-y-2">
                <Label>
                  Kunde <span className="text-destructive">*</span>
                </Label>

                {selectedCustomer && (
                  <div className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                    {getCustomerName(selectedCustomer)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {selectedCustomer.email || selectedCustomer.phone || selectedCustomer.city || ''}
                    </span>
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

                <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border">
                  {customers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Kunden gefunden
                    </p>
                  )}
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm',
                        selectedCustomerId === c.id && 'bg-primary/5 text-primary font-medium'
                      )}
                      onClick={() => setSelectedCustomerId(c.id)}
                    >
                      <span>{getCustomerName(c)}</span>
                      {(c.email || c.phone || c.city) && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {c.email || c.phone || c.city}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {!selectedCustomerId && mutation.isError && (
                  <p className="text-xs text-destructive">Bitte einen Kunden auswählen</p>
                )}
              </div>

              {/* Required */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Kennzeichen <span className="text-destructive">*</span></Label>
                  <Input placeholder="B-AB 1234" className="font-mono uppercase" {...register('licensePlate')} />
                  {errors.licensePlate && <p className="text-xs text-destructive">{errors.licensePlate.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Marke <span className="text-destructive">*</span></Label>
                  <Input placeholder="VW" {...register('make')} />
                  {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Modell <span className="text-destructive">*</span></Label>
                  <Input placeholder="Golf" {...register('model')} />
                  {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
                </div>
              </div>

              {/* HSN/TSN + FIN */}
              <div className="grid grid-cols-[100px_100px_1fr] gap-4">
                <div className="space-y-1">
                  <Label>HSN</Label>
                  <Input placeholder="0603" maxLength={4} {...register('hsn')} />
                  {errors.hsn && <p className="text-xs text-destructive">{errors.hsn.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>TSN</Label>
                  <Input placeholder="AUC" maxLength={3} className="uppercase" {...register('tsn')} />
                  {errors.tsn && <p className="text-xs text-destructive">{errors.tsn.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>FIN / VIN</Label>
                  <Input
                    placeholder="WVWZZZ1KZAW123456"
                    className="font-mono uppercase"
                    maxLength={17}
                    {...register('vin')}
                  />
                  {errors.vin && <p className="text-xs text-destructive">{errors.vin.message}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-3">
                HSN/TSN aus dem Fahrzeugschein (Felder 2.1 / 2.2). KBA-Suche folgt.
              </p>

              {/* KM (Pflicht) + Erstzulassung */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Kilometerstand <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    placeholder="125000"
                    min={0}
                    {...register('mileage', { valueAsNumber: true })}
                  />
                  {errors.mileage && <p className="text-xs text-destructive">{errors.mileage.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Erstzulassung</Label>
                  <Input type="date" {...register('firstRegistration')} />
                </div>
              </div>

              {/* Optional: Farbe, Kraftstoff, Getriebe, HU */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Farbe</Label>
                  <Input placeholder="Silber" {...register('color')} />
                </div>
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                <div className="space-y-1">
                  <Label>Nächste HU / AU</Label>
                  <Input type="date" {...register('nextTuvDate')} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notizen</Label>
                <Input placeholder="Interne Notizen..." {...register('notes')} />
              </div>
            </div>
          </form>

          <div className="flex justify-end gap-2 p-6 border-t shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="vehicle-form"
              disabled={mutation.isPending || !selectedCustomerId}
            >
              {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
