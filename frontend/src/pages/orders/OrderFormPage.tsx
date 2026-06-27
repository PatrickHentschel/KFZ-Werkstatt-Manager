import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { customersApi, type Customer } from '@/api/customers.api';
import { vehiclesApi } from '@/api/vehicles.api';
import { ordersApi } from '@/api/orders.api';
import { staffApi } from '@/api/staff.api';
import { partsApi } from '@/api/parts.api';
import { settingsApi } from '@/api/settings.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';
import { cn, formatCurrency } from '@/lib/utils';

const nanToUndefined = (v: unknown) => (typeof v === 'number' && isNaN(v) ? undefined : v);

const itemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']),
  description: z.string().min(1, 'Bezeichnung ist erforderlich'),
  quantity: z.preprocess(nanToUndefined, z.number({ invalid_type_error: 'Menge eingeben' }).positive('Menge muss größer als 0 sein')),
  unitPrice: z.preprocess(nanToUndefined, z.number({ invalid_type_error: 'Preis eingeben' }).nonnegative('Preis darf nicht negativ sein')),
  taxRate: z.preprocess(nanToUndefined, z.number({ invalid_type_error: 'MwSt eingeben' }).nonnegative('MwSt darf nicht negativ sein')),
  unit: z.string().optional(),
  partId: z.string().uuid().optional(),
  // Rabatt: kein Pflichtfeld, Default 0.
  discountPercent: z.preprocess(nanToUndefined, z.number().nonnegative().max(100, 'Rabatt max. 100%').optional()),
  discountAmount: z.preprocess(nanToUndefined, z.number().nonnegative('Rabattbetrag darf nicht negativ sein').optional()),
});

const orderSchema = z.object({
  customerId: z.string().min(1, 'Bitte einen Kunden auswählen'),
  vehicleId: z.string().min(1, 'Bitte ein Fahrzeug auswählen'),
  description: z.string().optional(),
  mileageIn: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && isNaN(v as number)) ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
  notes: z.string().optional(),
  assignedStaffId: z.string().optional(),
  // Skonto: kein Pflichtfeld, Default 0.
  skontoPercent: z.preprocess(nanToUndefined, z.number().nonnegative().max(100)).optional(),
  skontoDays: z.preprocess(nanToUndefined, z.number().int().nonnegative()).optional(),
  items: z.array(itemSchema),
});

type OrderForm = z.infer<typeof orderSchema>;

const TYPE_LABEL: Record<string, string> = { labor: 'Arbeit', part: 'Teil', misc: 'Sonstiges' };

function getCustomerName(c: Pick<Customer, 'type' | 'companyName' | 'firstName' | 'lastName'> | { companyName?: string; firstName?: string; lastName?: string }): string {
  const anyC = c as any;
  if (anyC.type === 'business') return anyC.companyName || '—';
  return anyC.companyName || `${anyC.firstName || ''} ${anyC.lastName || ''}`.trim() || '—';
}

export function OrderFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [customerSearch, setCustomerSearch] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [debouncedPartSearch, setDebouncedPartSearch] = useState('');
  // Display-only Map: partId → Einkaufspreis. Wird beim Hinzufügen via Picker
  // gefüllt; im Edit-Modus per batch-Fetch aus dem Stammdatenkatalog nachgeladen.
  const [partCosts, setPartCosts] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPartSearch(partSearch), 300);
    return () => clearTimeout(t);
  }, [partSearch]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    mode: 'onTouched',
    defaultValues: {
      customerId: '',
      vehicleId: '',
      items: [],
      assignedStaffId: '',
      // Default 0 — wird bei 0 nicht auf den Beleg geschrieben.
      skontoPercent: 0,
      skontoDays: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const customerId = watch('customerId');
  const vehicleId = watch('vehicleId');
  const items = watch('items');

  // Existierender Auftrag (Edit-Modus)
  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  // Edit-Modus: EK für referenzierte Teile aus dem Katalog batch-fetchen
  useEffect(() => {
    if (!isEdit || !existing) return;
    const partIds = [...new Set(
      existing.items.map((i) => i.partId).filter((x): x is string => Boolean(x)),
    )];
    if (partIds.length === 0) return;
    Promise.all(
      partIds.map((id) => partsApi.getById(id).then((r) => r.data).catch(() => null)),
    ).then((results) => {
      const next: Record<string, number> = {};
      for (const p of results) {
        if (p) next[p.id] = Number(p.purchasePrice);
      }
      setPartCosts(next);
    });
  }, [existing, isEdit]);

  useEffect(() => {
    if (!existing) return;
    reset({
      customerId: existing.customerId,
      vehicleId: existing.vehicleId,
      description: existing.description ?? '',
      mileageIn: existing.mileageIn,
      notes: existing.notes ?? '',
      assignedStaffId: existing.assignedStaffId ?? '',
      skontoPercent: Number(existing.skontoPercent ?? 0),
      skontoDays: Number(existing.skontoDays ?? 0),
      items: existing.items
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({
          type: i.type,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate),
          unit: i.unit ?? '',
          partId: i.partId ?? undefined,
          discountPercent: Number(i.discountPercent ?? 0) || undefined,
          discountAmount: Number(i.discountAmount ?? 0) || undefined,
        })),
    });
  }, [existing, reset]);

  // Customer-Liste — nur im Create-Modus relevant
  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 50, search: customerSearch || undefined }),
    enabled: !isEdit,
  });

  // Fahrzeuge gefiltert nach Kunde — nur im Create-Modus
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles', { customerId }],
    queryFn: () => vehiclesApi.list({ customerId, pageSize: 50 }),
    enabled: !isEdit && Boolean(customerId),
  });

  // Mitarbeiter
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });

  // Settings für Default-MwSt + §19 UStG
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });
  const isSmallBusiness = !!settingsData?.data?.isSmallBusiness;
  const defaultTaxRate = isSmallBusiness ? 0 : Number(settingsData?.data?.taxRate ?? 19);

  // Parts-Suche (debounced)
  const { data: partsData } = useQuery({
    queryKey: ['parts', { search: debouncedPartSearch }],
    queryFn: () => partsApi.list({ search: debouncedPartSearch, pageSize: 30 }),
    enabled: debouncedPartSearch.length > 1,
  });

  // Bei Kunden-Wechsel das Fahrzeug zurücksetzen (nur Create)
  useEffect(() => {
    if (isEdit) return;
    setValue('vehicleId', '', { shouldDirty: false, shouldValidate: false });
  }, [customerId, isEdit, setValue]);

  const customers = customersData?.data.data ?? [];
  const vehicles = vehiclesData?.data.data ?? [];
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const submitMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      const itemsWithSort = data.items.map((item, idx) => ({
        ...item,
        sortOrder: idx + 1,
        unit: item.unit || undefined,
        partId: item.partId || undefined,
        discountAmount: item.discountAmount ?? 0,
        discountPercent: item.discountPercent ?? 0,
      }));

      if (isEdit) {
        await ordersApi.update(id!, {
          description: data.description,
          mileageIn: data.mileageIn,
          notes: data.notes,
          assignedStaffId: data.assignedStaffId || undefined,
          skontoPercent: data.skontoPercent ?? 0,
          skontoDays: data.skontoDays ?? 0,
        });
        try {
          await ordersApi.updateItems(id!, itemsWithSort);
        } catch {
          throw new Error('Auftragsdaten gespeichert, aber die Positionen konnten nicht aktualisiert werden. Bitte erneut speichern.');
        }
        return id!;
      }

      const response = await ordersApi.create({
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        description: data.description,
        mileageIn: data.mileageIn,
        assignedStaffId: data.assignedStaffId || undefined,
        skontoPercent: data.skontoPercent ?? 0,
        skontoDays: data.skontoDays ?? 0,
      });
      if (data.items.length > 0) {
        await ordersApi.updateItems(response.data.id, itemsWithSort);
      }
      return response.data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast({ title: isEdit ? 'Auftrag aktualisiert' : 'Auftrag erstellt' });
      navigate('/orders');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || err.message || 'Speichern fehlgeschlagen',
      });
    },
  });

  const totals = items.reduce(
    (acc, item) => {
      const gross = (item.quantity || 0) * (item.unitPrice || 0);
      const dPct = item.discountPercent || 0;
      const dAbs = item.discountAmount || 0;
      const net = Math.max(0, gross - gross * (dPct / 100) - dAbs);
      return {
        net: acc.net + net,
        gross: acc.gross + net * (1 + (item.taxRate || 0) / 100),
      };
    },
    { net: 0, gross: 0 },
  );

  const addItem = (type: 'labor' | 'part' | 'misc') => {
    append({
      type,
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: defaultTaxRate,
      unit: type === 'labor' ? 'AW' : undefined,
    });
  };

  const addPartFromPicker = (part: {
    id: string; name: string; sku: string;
    salePrice: number | string; purchasePrice: number | string; taxRate: number | string;
  }) => {
    setPartCosts((prev) => ({ ...prev, [part.id]: Number(part.purchasePrice) }));
    append({
      type: 'part',
      description: `${part.name} (${part.sku})`,
      quantity: 1,
      unitPrice: Number(part.salePrice),
      taxRate: Number(part.taxRate),
      partId: part.id,
    });
  };

  const handleStaffSelectForItem = (idx: number, staffId: string) => {
    const staff = staffData?.data.data.find((s) => s.id === staffId);
    if (!staff) return;
    const awRate = settingsData?.data?.awRate;
    if (awRate) {
      setValue(`items.${idx}.unitPrice`, Number(awRate), { shouldDirty: true });
      setValue(`items.${idx}.unit`, 'AW', { shouldDirty: true });
    }
  };

  if (isEdit && isLoadingExisting) {
    return (
      <ResourceFormLayout
        title="Auftrag bearbeiten"
        onCancel={() => navigate('/orders')}
        onSubmit={(e) => e.preventDefault()}
        isSubmitting
        submitLabel="Speichern"
        className="max-w-6xl"
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

  const isLocked = isEdit && existing?.status === 'invoiced';

  return (
    <ResourceFormLayout
      title={isEdit ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}
      subtitle={isEdit && existing ? `${existing.orderNumber}` : undefined}
      onCancel={() => navigate('/orders')}
      onSubmit={handleSubmit((d) => submitMutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={submitMutation.isPending}
      submitLabel={isEdit ? 'Speichern' : 'Auftrag erstellen'}
      className="max-w-6xl"
    >
      {isLocked && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          Dieser Auftrag ist verrechnet. Positionen sind gesperrt, damit die bereits erstellte Rechnung nicht verändert wird.
        </div>
      )}

      {/* Kunde + Fahrzeug — read-only im Edit */}
      {isEdit && existing ? (
        <FormSection title="Kunde & Fahrzeug" description="Bei bestehenden Aufträgen nicht änderbar">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">Kunde</div>
              <div className="font-medium">
                {existing.customer ? getCustomerName(existing.customer) : '—'}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">Fahrzeug</div>
              <div className="font-medium font-mono">
                {existing.vehicle?.licensePlate || '—'}
                {existing.vehicle && (
                  <span className="ml-2 font-sans font-normal">
                    {existing.vehicle.make} {existing.vehicle.model}
                  </span>
                )}
              </div>
            </div>
          </div>
        </FormSection>
      ) : (
        <>
          <FormSection title="Kunde">
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
            <div className="space-y-1 max-h-72 overflow-y-auto rounded-md border">
              {customers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Keine Kunden gefunden</p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/50 transition-colors',
                      customerId === c.id && 'bg-primary/5 text-primary font-medium',
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

          <FormSection title="Fahrzeug">
            {!customerId ? (
              <p className="text-sm text-muted-foreground py-4">Zuerst einen Kunden auswählen</p>
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Keine Fahrzeuge für diesen Kunden</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                      vehicleId === v.id && 'border-primary bg-primary/5',
                    )}
                    onClick={() => setValue('vehicleId', v.id, { shouldDirty: true, shouldValidate: true })}
                  >
                    <div className="font-mono font-medium">{v.licensePlate}</div>
                    <div className="text-sm">{v.make} {v.model}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        v.firstRegistration ? new Date(v.firstRegistration).getFullYear() : null,
                        v.fuelType,
                        v.mileage ? `${v.mileage.toLocaleString('de-DE')} km` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {errors.vehicleId && <p className="text-xs text-destructive">{errors.vehicleId.message}</p>}
          </FormSection>
        </>
      )}

      <FormSection title="Auftragsdetails">
        <div className="space-y-2">
          <Label>Auftragsbeschreibung</Label>
          <Input placeholder="z.B. Jahresservice, Reifenwechsel..." {...register('description')} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Kilometerstand (Eingang)</Label>
            <Input
              type="number"
              placeholder={selectedVehicle?.mileage ? String(selectedVehicle.mileage) : '125000'}
              {...register('mileageIn', { valueAsNumber: true })}
            />
            {errors.mileageIn && <p className="text-xs text-destructive">{errors.mileageIn.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Notizen</Label>
            <textarea
              rows={3}
              placeholder="Interne Notizen..."
              {...register('notes')}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Zuständiger Mitarbeiter</Label>
          <select
            {...register('assignedStaffId')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Kein Mitarbeiter —</option>
            {staffData?.data.data.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div className="text-sm font-medium">Skonto (optional)</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Skonto-Satz (%)</Label>
              <Input type="number" step="0.5" min="0" max="100" placeholder="0"
                {...register('skontoPercent', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Innerhalb (Tage)</Label>
              <Input type="number" min="0" placeholder="0"
                {...register('skontoDays', { valueAsNumber: true })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Wird bei der Rechnungserstellung übernommen. Bei 0 nicht auf den Beleg gedruckt.
          </p>
        </div>
      </FormSection>

      <fieldset disabled={isLocked} className="contents">
      <FormSection
        title="Positionen"
        description="Teile suchen oder manuell hinzufügen — ein Klick übernimmt Name, Preis und MwSt aus den Stammdaten."
      >
        <div className="space-y-3">
          {/* Toolbar: manuelle Typ-Buttons + Teile-Suche gehören zur selben Aufgabe */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['labor', 'part', 'misc'] as const).map((t) => (
                <Button key={t} type="button" variant="outline" size="sm" onClick={() => addItem(t)}>
                  <Plus className="mr-1 h-3 w-3" /> {TYPE_LABEL[t]}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Teile suchen (Name, SKU, OEM)..."
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {debouncedPartSearch.length > 1 && (
            partsData?.data.data.length === 0 ? (
              <p className="rounded-md border bg-muted/20 py-4 text-center text-sm text-muted-foreground">
                Keine Teile gefunden
              </p>
            ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium font-mono text-xs">SKU / OEM</th>
                  <th className="px-3 py-2 text-left font-medium">Kategorie</th>
                  <th className="px-3 py-2 text-right font-medium">Bestand</th>
                  <th className="px-3 py-2 text-right font-medium">EK (€)</th>
                  <th className="px-3 py-2 text-right font-medium">VK (€)</th>
                  <th className="px-3 py-2 text-right font-medium">MwSt</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y max-h-[480px]">
                {partsData?.data.data.map((p) => {
                  const lowStock = Number(p.stockQuantity) <= Number(p.minStock);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => addPartFromPicker({
                        id: p.id, name: p.name, sku: p.sku,
                        salePrice: p.salePrice, purchasePrice: p.purchasePrice,
                        taxRate: p.taxRate,
                      })}
                    >
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        <div>{p.sku}</div>
                        {p.oemNumber && <div className="text-[10px]">{p.oemNumber}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
                      </td>
                      <td className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        lowStock && 'text-warning font-medium',
                      )}>
                        {p.stockQuantity} {p.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(Number(p.purchasePrice))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(Number(p.salePrice))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {Number(p.taxRate)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Plus className="inline h-4 w-4 text-primary" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        ))}

            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                Noch keine Positionen
              </p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] space-y-2">
                    <div className="grid grid-cols-[70px_minmax(0,1fr)_100px_100px_100px_70px_40px] gap-2 px-2 text-xs text-muted-foreground">
                      <div>Typ</div>
                      <div>Bezeichnung</div>
                      <div>Menge</div>
                      <div className="text-right">EK (€)</div>
                      <div className="text-right">VK (€)</div>
                      <div className="text-right">MwSt</div>
                      <div />
                    </div>
                    <div className="rounded-lg border divide-y">
                {fields.map((field, idx) => {
                  const itemType = field.type;
                  const ek = field.partId ? partCosts[field.partId] : undefined;
                  return (
                    <div key={field.id} className="p-2 space-y-2">
                      <div className="grid grid-cols-[70px_minmax(0,1fr)_100px_100px_100px_70px_40px] gap-2 items-start">
                        <div className="pt-1">
                          <Badge variant="outline" className="text-xs">{TYPE_LABEL[itemType]}</Badge>
                        </div>
                        <div className="min-w-0">
                          <Input
                            placeholder="Beschreibung"
                            {...register(`items.${idx}.description`)}
                            className="h-8 text-sm"
                          />
                          {errors.items?.[idx]?.description && (
                            <p className="text-xs text-destructive">{errors.items[idx].description?.message}</p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="1"
                              placeholder="Menge"
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              className="h-8 text-sm"
                            />
                            {itemType === 'labor' && (
                              <span className="text-xs text-muted-foreground font-medium shrink-0">
                                {watch(`items.${idx}.unit`) || 'AW'}
                              </span>
                            )}
                          </div>
                          {errors.items?.[idx]?.quantity && <p className="text-xs text-destructive">{errors.items[idx].quantity?.message}</p>}
                        </div>
                        <div className="h-8 flex items-center justify-end text-sm tabular-nums text-muted-foreground">
                          {ek != null ? formatCurrency(ek) : '—'}
                        </div>
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Preis €"
                            {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                            className="h-8 text-sm text-right tabular-nums"
                          />
                          {errors.items?.[idx]?.unitPrice && <p className="text-xs text-destructive">{errors.items[idx].unitPrice?.message}</p>}
                        </div>
                        <div>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder="%"
                            {...register(`items.${idx}.taxRate`, { valueAsNumber: true })}
                            className="h-8 text-sm text-right tabular-nums"
                          />
                          {errors.items?.[idx]?.taxRate && <p className="text-xs text-destructive">{errors.items[idx].taxRate?.message}</p>}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => remove(idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {itemType === 'labor' && staffData?.data.data && staffData.data.data.length > 0 && (
                        <div className="pl-1 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Mitarbeiter:</span>
                          <select
                            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            defaultValue=""
                            onChange={(e) => handleStaffSelectForItem(idx, e.target.value)}
                          >
                            <option value="">— Satz übernehmen —</option>
                            {staffData.data.data.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.firstName} {s.lastName}
                                {settingsData?.data?.awRate
                                  ? ` (${formatCurrency(Number(settingsData.data.awRate))}/AW)`
                                  : s.hourlyRate
                                  ? ` (${formatCurrency(Number(s.hourlyRate))}/h)`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="pl-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Rabatt:</span>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          placeholder="%"
                          className="h-7 w-20 text-xs"
                          {...register(`items.${idx}.discountPercent`, { valueAsNumber: true })}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="€"
                          className="h-7 w-24 text-xs"
                          {...register(`items.${idx}.discountAmount`, { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  );
                })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 text-sm pt-1">
                  <span className="text-muted-foreground">
                    Netto: <span className="font-medium text-foreground">{formatCurrency(totals.net)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Brutto: <span className="font-medium text-foreground">{formatCurrency(totals.gross)}</span>
                  </span>
                </div>
              </div>
            )}
        </div>
      </FormSection>
      </fieldset>
    </ResourceFormLayout>
  );
}
