import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { customersApi, type Customer } from '@/api/customers.api';
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api';
import { ordersApi } from '@/api/orders.api';
import { staffApi } from '@/api/staff.api';
import { partsApi } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const nanToUndefined = (v: unknown) =>
  typeof v === 'number' && isNaN(v) ? undefined : v;

const itemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']),
  description: z.string().min(1, 'Pflichtfeld'),
  quantity: z.preprocess(nanToUndefined, z.number().positive()),
  unitPrice: z.preprocess(nanToUndefined, z.number().nonnegative()),
  taxRate: z.preprocess(nanToUndefined, z.number().nonnegative()),
  unit: z.string().optional(),
  partId: z.string().uuid().optional(),
});

const orderSchema = z.object({
  description: z.string().optional(),
  mileageIn: z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v as number)) ? undefined : Number(v)),
    z.number().int().positive().optional()
  ),
  notes: z.string().optional(),
  assignedStaffId: z.string().optional(),
  items: z.array(itemSchema),
});

type OrderForm = z.infer<typeof orderSchema>;

const TYPE_LABEL: Record<string, string> = { labor: 'Arbeit', part: 'Teil', misc: 'Sonstiges' };

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OrderDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Parts picker state
  const [partPickerIdx, setPartPickerIdx] = useState<number | null>(null);
  const [partPickerSearch, setPartPickerSearch] = useState('');
  const [debouncedPartSearch, setDebouncedPartSearch] = useState('');

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { items: [], assignedStaffId: '' },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPartSearch(partPickerSearch), 300);
    return () => clearTimeout(timer);
  }, [partPickerSearch]);

  // Reset all state when the dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setCustomerSearch('');
      setSelectedCustomer(null);
      setSelectedVehicle(null);
      setPartPickerIdx(null);
      setPartPickerSearch('');
      reset({ items: [], assignedStaffId: '' });
    }
  }, [open, reset]);

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 20, search: customerSearch || undefined }),
    enabled: step === 1,
  });

  // Fetch vehicles filtered by the selected customer
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', { customerId: selectedCustomer?.id }],
    queryFn: () => vehiclesApi.list({ customerId: selectedCustomer!.id, pageSize: 50 }),
    enabled: step === 2 && !!selectedCustomer,
  });

  // Fetch staff list for step 3
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
    enabled: step === 3,
  });

  // Fetch parts for picker
  const { data: partsData } = useQuery({
    queryKey: ['parts', { search: debouncedPartSearch }],
    queryFn: () => partsApi.list({ search: debouncedPartSearch, pageSize: 20 }),
    enabled: debouncedPartSearch.length > 1,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      const response = await ordersApi.create({
        customerId: selectedCustomer!.id,
        vehicleId: selectedVehicle!.id,
        description: data.description,
        mileageIn: data.mileageIn,
        assignedStaffId: data.assignedStaffId || undefined,
      });
      if (data.items.length > 0) {
        const itemsWithSort = data.items.map((item, idx) => ({
          ...item,
          sortOrder: idx + 1,
          partId: item.partId || undefined,
        }));
        await ordersApi.updateItems(response.data.id, itemsWithSort);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Auftrag erstellt' });
      onClose();
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Auftrag konnte nicht erstellt werden',
      });
    },
  });

  const getCustomerName = (c: Customer) =>
    c.type === 'business'
      ? c.companyName || '—'
      : `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';

  const items = watch('items');
  const { totalNet, totalGross } = items.reduce(
    (acc: { totalNet: number; totalGross: number }, item: OrderForm['items'][number]) => {
      const net = (item.quantity || 0) * (item.unitPrice || 0);
      return { totalNet: acc.totalNet + net, totalGross: acc.totalGross + net * (1 + (item.taxRate || 0) / 100) };
    },
    { totalNet: 0, totalGross: 0 }
  );

  const handleSelectPart = (idx: number, part: { id: string; name: string; salePrice: number; taxRate: number }) => {
    setValue(`items.${idx}.description`, part.name);
    setValue(`items.${idx}.unitPrice`, part.salePrice);
    setValue(`items.${idx}.taxRate`, part.taxRate);
    setValue(`items.${idx}.partId`, part.id);
    setPartPickerIdx(null);
    setPartPickerSearch('');
  };

  const handleStaffSelectForItem = (idx: number, staffId: string) => {
    const staff = staffData?.data.data.find((s) => s.id === staffId);
    if (staff?.hourlyRate) {
      setValue(`items.${idx}.unitPrice`, staff.hourlyRate);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold">Neuer Auftrag</Dialog.Title>
              <div className="flex items-center gap-2 mt-1">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <div
                      className={cn(
                        'h-6 w-6 rounded-full text-xs flex items-center justify-center font-medium',
                        step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {s}
                    </div>
                    <span className={cn('text-xs', step === s ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {s === 1 ? 'Kunde' : s === 2 ? 'Fahrzeug' : 'Details'}
                    </span>
                    {s < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Step 1: Customer selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Kunden suchen..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {customersData?.data.data.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Keine Kunden gefunden</p>
                  )}
                  {customersData?.data.data.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        'w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors',
                        selectedCustomer?.id === c.id && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <div className="font-medium">{getCustomerName(c)}</div>
                      <div className="text-sm text-muted-foreground">{c.email || c.phone || c.city || ''}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Vehicle selection */}
            {step === 2 && (
              <div className="space-y-3">
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">
                    Fahrzeuge von: <span className="font-medium text-foreground">{getCustomerName(selectedCustomer)}</span>
                  </p>
                )}
                {vehiclesData?.data.data.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Fahrzeuge für diesen Kunden</p>
                )}
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {vehiclesData?.data.data.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={cn(
                        'w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors',
                        selectedVehicle?.id === v.id && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedVehicle(v)}
                    >
                      <div className="font-medium font-mono">
                        {v.licensePlate}{' '}
                        <span className="font-sans font-normal">— {v.make} {v.model}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[v.year, v.fuelType, v.mileage ? `${v.mileage.toLocaleString('de-AT')} km` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Order details + line items */}
            {step === 3 && (
              <div className="space-y-6">

                {/* Context summary */}
                <div className="flex gap-4 rounded-lg bg-muted/50 p-3 text-sm">
                  <span>
                    <span className="text-muted-foreground">Kunde: </span>
                    <span className="font-medium">{getCustomerName(selectedCustomer!)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Fahrzeug: </span>
                    <span className="font-medium font-mono">{selectedVehicle!.licensePlate}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label>Auftragsbeschreibung</Label>
                    <Input placeholder="z.B. Jahresservice, Reifenwechsel..." {...register('description')} />
                  </div>
                  <div className="space-y-1">
                    <Label>Kilometerstand (Eingang)</Label>
                    <Input
                      type="number"
                      placeholder="125000"
                      {...register('mileageIn', { valueAsNumber: true })}
                    />
                    {errors.mileageIn && (
                      <p className="text-xs text-destructive">{errors.mileageIn.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Notizen</Label>
                    <Input placeholder="Interne Notizen..." {...register('notes')} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Zuständiger Mitarbeiter</Label>
                    <select
                      {...register('assignedStaffId')}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— Kein Mitarbeiter —</option>
                      {staffData?.data.data.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Line items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Positionen</Label>
                    <div className="flex gap-1">
                      {(['labor', 'part', 'misc'] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({ type: t, description: '', quantity: 1, unitPrice: 0, taxRate: 20 })}
                        >
                          <Plus className="mr-1 h-3 w-3" /> {TYPE_LABEL[t]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                      Noch keine Positionen — optional, können später hinzugefügt werden
                    </p>
                  )}

                  {fields.length > 0 && (
                    <div className="grid grid-cols-12 gap-1 px-2 pb-1">
                      <div className="col-span-1" />
                      <div className="col-span-5 text-xs text-muted-foreground">Bezeichnung</div>
                      <div className="col-span-2 text-xs text-muted-foreground">Menge</div>
                      <div className="col-span-2 text-xs text-muted-foreground">EP (€)</div>
                      <div className="col-span-1 text-xs text-muted-foreground">MwSt %</div>
                      <div className="col-span-1" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {fields.map((field, idx) => {
                      const itemType = field.type;
                      return (
                        <div key={field.id} className="rounded-lg border p-2 space-y-2">
                          {/* Row 1: Type badge + description + actions */}
                          <div className="grid grid-cols-12 gap-1 items-start">
                            <div className="col-span-1 pt-1">
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABEL[itemType]}
                              </Badge>
                            </div>

                            {/* Description field with parts picker for part type */}
                            <div className="col-span-5 relative">
                              {itemType === 'part' ? (
                                <div className="flex gap-1">
                                  <Input
                                    placeholder="Beschreibung"
                                    {...register(`items.${idx}.description`)}
                                    className="h-8 text-sm"
                                  />
                                  <button
                                    type="button"
                                    className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors"
                                    onClick={() => {
                                      setPartPickerIdx(partPickerIdx === idx ? null : idx);
                                      setPartPickerSearch('');
                                    }}
                                    title="Teil suchen"
                                  >
                                    <Search className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </div>
                              ) : (
                                <Input
                                  placeholder="Beschreibung"
                                  {...register(`items.${idx}.description`)}
                                  className="h-8 text-sm"
                                />
                              )}
                              {errors.items?.[idx]?.description && (
                                <p className="text-xs text-destructive">Pflichtfeld</p>
                              )}

                              {/* Parts picker dropdown */}
                              {itemType === 'part' && partPickerIdx === idx && (
                                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border bg-background shadow-md">
                                  <div className="p-2 border-b">
                                    <Input
                                      placeholder="Artikel suchen..."
                                      value={partPickerSearch}
                                      onChange={(e) => setPartPickerSearch(e.target.value)}
                                      className="h-7 text-xs"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="max-h-40 overflow-y-auto">
                                    {partPickerSearch.length <= 1 && (
                                      <p className="text-xs text-muted-foreground text-center py-3 px-2">
                                        Mind. 2 Zeichen eingeben...
                                      </p>
                                    )}
                                    {partPickerSearch.length > 1 && partsData?.data.data.length === 0 && (
                                      <p className="text-xs text-muted-foreground text-center py-3 px-2">
                                        Keine Artikel gefunden
                                      </p>
                                    )}
                                    {partsData?.data.data.map((part) => (
                                      <button
                                        key={part.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b last:border-b-0"
                                        onClick={() => handleSelectPart(idx, {
                                          id: part.id,
                                          name: part.name,
                                          salePrice: part.salePrice,
                                          taxRate: part.taxRate,
                                        })}
                                      >
                                        <span className="font-medium">{part.name}</span>
                                        <span className="text-muted-foreground ml-2">({part.sku})</span>
                                        <span className="float-right text-muted-foreground">
                                          {part.salePrice.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="col-span-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Menge"
                                {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Preis €"
                                {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-1">
                              <Input
                                type="number"
                                step="0.5"
                                placeholder="MwSt %"
                                {...register(`items.${idx}.taxRate`, { valueAsNumber: true })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (partPickerIdx === idx) setPartPickerIdx(null);
                                  remove(idx);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Row 2 (labor only): staff auto-fill */}
                          {itemType === 'labor' && staffData?.data.data && staffData.data.data.length > 0 && (
                            <div className="pl-1 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground shrink-0">Mitarbeiter:</span>
                              <select
                                className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                defaultValue=""
                                onChange={(e) => handleStaffSelectForItem(idx, e.target.value)}
                              >
                                <option value="">— Stundensatz übernehmen —</option>
                                {staffData.data.data.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.firstName} {s.lastName}
                                    {s.hourlyRate ? ` (${s.hourlyRate.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}/h)` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {fields.length > 0 && (
                    <div className="flex justify-end gap-4 text-sm pt-1">
                      <span className="text-muted-foreground">
                        Netto:{' '}
                        <span className="font-medium text-foreground">
                          {totalNet.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Brutto:{' '}
                        <span className="font-medium text-foreground">
                          {totalGross.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => step > 1 ? setStep((s) => s - 1) : onClose()}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {step === 1 ? 'Abbrechen' : 'Zurück'}
            </Button>

            {step < 3 ? (
              <Button
                key="btn-next"
                type="button"
                disabled={(step === 1 && !selectedCustomer) || (step === 2 && !selectedVehicle)}
                onClick={() => setStep((s) => s + 1)}
              >
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit((d) => createOrderMutation.mutate(d))}
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? 'Wird erstellt...' : 'Auftrag erstellen'}
              </Button>
            )}
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
