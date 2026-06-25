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
import { ordersApi } from '@/api/orders.api';
import { partsApi } from '@/api/parts.api';
import { staffApi } from '@/api/staff.api';
import { invoicesApi, type DraftInvoicePayload } from '@/api/invoices.api';
import { settingsApi } from '@/api/settings.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';
import { cn, formatCurrency } from '@/lib/utils';

const nanToUndefined = (v: unknown) => (typeof v === 'number' && isNaN(v) ? undefined : v);

const itemSchema = z.object({
  type: z.enum(['labor', 'part', 'misc']),
  description: z.string().min(1, 'Pflichtfeld'),
  quantity: z.preprocess(nanToUndefined, z.number().positive()),
  unitPrice: z.preprocess(nanToUndefined, z.number().nonnegative()),
  unitCost: z.preprocess(nanToUndefined, z.number().nonnegative().optional()),
  taxRate: z.preprocess(nanToUndefined, z.number().nonnegative()),
  unit: z.string().optional(),
  partId: z.string().uuid().optional(),
  serviceDate: z.string().optional(),
  discountPercent: z.preprocess(nanToUndefined, z.number().nonnegative().max(100).optional()),
  discountAmount: z.preprocess(nanToUndefined, z.number().nonnegative().optional()),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Bitte einen Kunden auswählen'),
  type: z.enum(['invoice', 'quote', 'credit_note']),
  serviceDate: z.string().optional(),
  dueDate: z.string().min(1, 'Fälligkeitsdatum ist Pflicht'),
  notes: z.string().optional(),
  orderId: z.string().optional(),
  skontoPercent: z.preprocess(nanToUndefined, z.number().nonnegative().max(100)).optional(),
  skontoDays: z.preprocess(nanToUndefined, z.number().int().nonnegative()).optional(),
  items: z.array(itemSchema),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const TYPE_LABEL: Record<string, string> = { labor: 'Arbeit', part: 'Teil', misc: 'Sonstiges' };

const todayStr = () => new Date().toISOString().split('T')[0];
const dueInDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

function getCustomerName(c: Pick<Customer, 'type' | 'companyName' | 'firstName' | 'lastName'> | { companyName?: string; firstName?: string; lastName?: string }): string {
  const anyC = c as any;
  if (anyC.type === 'business') return anyC.companyName || '—';
  return anyC.companyName || `${anyC.firstName || ''} ${anyC.lastName || ''}`.trim() || '—';
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [customerSearch, setCustomerSearch] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [debouncedPartSearch, setDebouncedPartSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPartSearch(partSearch), 300);
    return () => clearTimeout(t);
  }, [partSearch]);

  // Existierende Rechnung (Edit-Modus) — nur drafts können bearbeitet werden
  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: '',
      type: 'invoice',
      serviceDate: todayStr(),
      dueDate: dueInDays(14),
      skontoPercent: 0,
      skontoDays: 0,
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  const customerId = watch('customerId');
  const orderId = watch('orderId');
  const items = watch('items');

  // Settings für §19 UStG + Default-MwSt
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });
  const awMinutes = settingsData?.data?.awMinutes ?? 5;
  const isSmallBusiness = !!settingsData?.data?.isSmallBusiness;
  const defaultTaxRate = isSmallBusiness ? 0 : Number(settingsData?.data?.taxRate ?? 19);

  // Kunden für Picker (Create-Modus)
  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 50, search: customerSearch || undefined }),
    enabled: !isEdit,
  });

  // Aufträge des gewählten Kunden für optionale Verknüpfung
  const { data: ordersData } = useQuery({
    queryKey: ['orders', { customerId }],
    queryFn: () => ordersApi.list({ customerId, pageSize: 50 } as any),
    enabled: Boolean(customerId),
  });

  // Parts-Suche
  const { data: partsData } = useQuery({
    queryKey: ['parts', { search: debouncedPartSearch }],
    queryFn: () => partsApi.list({ search: debouncedPartSearch, pageSize: 30 }),
    enabled: debouncedPartSearch.length > 1,
  });

  // Mitarbeiter
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });

  // Edit-Modus initial reset
  useEffect(() => {
    if (!existing) return;
    reset({
      customerId: existing.customerId,
      type: existing.type,
      serviceDate: existing.serviceDate || existing.issueDate || todayStr(),
      dueDate: existing.dueDate || dueInDays(14),
      notes: existing.notes || '',
      orderId: existing.orderId || '',
      skontoPercent: Number(existing.skontoPercent ?? 0),
      skontoDays: Number(existing.skontoDays ?? 0),
      items: [...existing.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          type: (item.type ?? 'misc') as 'labor' | 'part' | 'misc',
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitCost: item.unitCost != null ? Number(item.unitCost) : undefined,
          taxRate: Number(item.taxRate),
          unit: item.unit,
          serviceDate: item.serviceDate || undefined,
          discountPercent: Number(item.discountPercent ?? 0) || undefined,
          discountAmount: Number(item.discountAmount ?? 0) || undefined,
        })),
    });
  }, [existing, reset]);

  // Bei Auftragswahl im Create-Modus: Items übernehmen wenn noch leer
  useEffect(() => {
    if (isEdit) return;
    if (!orderId) return;
    if (fields.length > 0) return;
    ordersApi.getById(orderId).then((r) => {
      const orderItems = r.data.items;
      if (!orderItems.length) return;
      replace(
        [...orderItems]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ type, description, quantity, unitPrice, taxRate, unit }) => ({
            type,
            description,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            taxRate: Number(taxRate),
            unit: unit || undefined,
          })),
      );
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const customers = customersData?.data.data ?? [];
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const buildItemsPayload = (formItems: InvoiceForm['items']) =>
    formItems.map((item, idx) => ({
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      taxRate: isSmallBusiness ? 0 : item.taxRate,
      unit: item.unit,
      serviceDate: item.serviceDate || undefined,
      discountPercent: item.discountPercent ?? undefined,
      discountAmount: item.discountAmount ?? undefined,
      sortOrder: idx + 1,
    }));

  // Submit (final) — Create oder Edit
  const submitMutation = useMutation({
    mutationFn: async (data: InvoiceForm) => {
      const payload = {
        customerId: data.customerId,
        orderId: data.orderId || undefined,
        type: data.type,
        serviceDate: data.serviceDate || undefined,
        dueDate: data.dueDate,
        notes: data.notes,
        skontoPercent: data.skontoPercent ?? 0,
        skontoDays: data.skontoDays ?? 0,
        items: buildItemsPayload(data.items),
      };
      if (isEdit) {
        return invoicesApi.update(id!, {
          type: data.type,
          serviceDate: data.serviceDate || null,
          dueDate: data.dueDate,
          notes: data.notes,
          orderId: data.orderId || undefined,
          skontoPercent: data.skontoPercent ?? 0,
          skontoDays: data.skontoDays ?? 0,
          items: buildItemsPayload(data.items),
        });
      }
      return invoicesApi.create(payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['invoices', id] });
      toast({ title: isEdit ? 'Rechnung aktualisiert' : 'Rechnung erstellt' });
      navigate('/invoices');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Speichern fehlgeschlagen',
      });
    },
  });

  // Draft speichern (im Hintergrund über expliziten Button)
  const draftMutation = useMutation({
    mutationFn: async () => {
      const data = getValues();
      const payload: DraftInvoicePayload = {
        customerId: data.customerId,
        type: data.type,
        serviceDate: data.serviceDate || undefined,
        dueDate: data.dueDate || undefined,
        notes: data.notes || undefined,
        orderId: data.orderId || undefined,
        skontoPercent: data.skontoPercent ?? 0,
        skontoDays: data.skontoDays ?? 0,
        items: buildItemsPayload(data.items),
      };
      if (isEdit) {
        return invoicesApi.updateDraft(id!, payload);
      }
      return invoicesApi.createDraft(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Entwurf gespeichert' });
      // Bei Create-Modus mit erfolgreichem Draft-Save: zur Edit-URL navigieren,
      // damit weitere Speicherungen das gleiche Draft updaten.
      if (!isEdit && res.data.id) {
        navigate(`/invoices/${res.data.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Entwurf konnte nicht gespeichert werden',
      });
    },
  });

  const totals = items.reduce(
    (acc, item) => {
      const gross = (item.quantity || 0) * (item.unitPrice || 0);
      const dPct = item.discountPercent || 0;
      const dAbs = item.discountAmount || 0;
      const net = Math.max(0, gross - gross * (dPct / 100) - dAbs);
      const effectiveTax = isSmallBusiness ? 0 : (item.taxRate || 0);
      return {
        net: acc.net + net,
        gross: acc.gross + net * (1 + effectiveTax / 100),
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
    append({
      type: 'part',
      description: `${part.name} (${part.sku})`,
      quantity: 1,
      unitPrice: Number(part.salePrice),
      unitCost: Number(part.purchasePrice),
      taxRate: isSmallBusiness ? 0 : Number(part.taxRate),
      partId: part.id,
    });
  };

  const handleStaffSelectForItem = (idx: number, staffId: string) => {
    const member = staffData?.data.data.find((s) => s.id === staffId);
    if (!member) return;
    const awRate = settingsData?.data?.awRate;
    if (awRate) {
      setValue(`items.${idx}.unitPrice`, Number(awRate), { shouldDirty: true });
      setValue(`items.${idx}.unit`, 'AW', { shouldDirty: true });
    }
    if (member.hourlyRate) {
      setValue(`items.${idx}.unitCost`, Number(member.hourlyRate) * (awMinutes / 60), { shouldDirty: true });
    }
  };

  const isDraft = !isEdit || existing?.status === 'draft';
  const submitLabel = isEdit ? 'Speichern' : 'Rechnung erstellen';

  if (isEdit && isLoadingExisting) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
  }

  // Edit-Schutz: nicht-drafts sollten gar nicht hier landen
  if (isEdit && existing && existing.status !== 'draft') {
    return (
      <div className="rounded-md border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
        <p className="font-medium">Diese Rechnung kann nicht bearbeitet werden.</p>
        <p>Status <strong>{existing.status}</strong> ist final (§14 UStG). Verwende Storno für Korrekturen.</p>
        <Button className="mt-3" variant="outline" onClick={() => navigate('/invoices')}>Zurück</Button>
      </div>
    );
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
      subtitle={isEdit && existing ? `${existing.invoiceNumber} · Entwurf` : undefined}
      onCancel={() => navigate('/invoices')}
      onSubmit={handleSubmit((d) => submitMutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={submitMutation.isPending}
      submitLabel={submitLabel}
      className="max-w-6xl"
      footerActions={
        isDraft && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending || !customerId}
            title={!customerId ? 'Erst einen Kunden wählen' : undefined}
          >
            {draftMutation.isPending ? 'Wird gespeichert...' : 'Als Entwurf speichern'}
          </Button>
        )
      }
    >
      {/* Kunde */}
      {isEdit && existing ? (
        <FormSection title="Kunde" description="Bei bestehenden Entwürfen nicht änderbar">
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <div className="font-medium">
              {existing.customer ? getCustomerName(existing.customer) : '—'}
            </div>
          </div>
        </FormSection>
      ) : (
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
      )}

      {/* Rechnungsdetails */}
      <FormSection title="Rechnungsdetails">
        {isSmallBusiness && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Kleinunternehmer (§19 UStG):</strong> Alle Positionen erhalten 0% MwSt.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Typ</Label>
            <select
              {...register('type')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="invoice">Rechnung</option>
              <option value="quote">Angebot</option>
              <option value="credit_note">Gutschrift</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Leistungsdatum (§14 UStG)</Label>
            <Input type="date" {...register('serviceDate')} />
            <p className="text-xs text-muted-foreground">
              Ausstellungsdatum wird beim Versenden automatisch gesetzt.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Fälligkeitsdatum <span className="text-destructive">*</span></Label>
            <Input type="date" {...register('dueDate')} />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Notizen</Label>
            <Input placeholder="Interne Notizen..." {...register('notes')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Auftrag verknüpfen</Label>
          <select
            {...register('orderId')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={!customerId}
          >
            <option value="">Kein Auftrag</option>
            {ordersData?.data.data.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}{o.description ? ` — ${o.description}` : ''}
              </option>
            ))}
          </select>
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Wenn du einen Auftrag wählst und noch keine Positionen vorhanden sind, werden die Auftrags-Positionen übernommen.
            </p>
          )}
        </div>
        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div className="text-sm font-medium">Skonto (optional)</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Skonto-Satz (%)</Label>
              <Input type="number" step="0.5" min="0" max="100" placeholder="2"
                {...register('skontoPercent', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Innerhalb (Tage)</Label>
              <Input type="number" min="0" placeholder="7"
                {...register('skontoDays', { valueAsNumber: true })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bei Zahlung innerhalb der angegebenen Tage gewährt die Werkstatt diesen Skonto-Abzug.
          </p>
        </div>
      </FormSection>

      {/* Teile-Suche */}
      <FormSection title="Teile-Suche" description="Klick fügt Position automatisch hinzu (Name, Preis, MwSt aus Stammdaten)">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name, SKU, OEM-Nummer..."
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        {debouncedPartSearch.length <= 1 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Mind. 2 Zeichen eingeben um Teile zu suchen
          </p>
        ) : partsData?.data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Keine Teile gefunden
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
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
              <tbody className="divide-y">
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
                        lowStock && 'text-orange-600 font-medium',
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
        )}
      </FormSection>

      {/* Positionen */}
      <FormSection title="Positionen" description="Manuell hinzufügen oder via Teile-Suche oben">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['labor', 'part', 'misc'] as const).map((t) => (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => addItem(t)}>
                <Plus className="mr-1 h-3 w-3" /> {TYPE_LABEL[t]}
              </Button>
            ))}
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
              Noch keine Positionen
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[70px_minmax(0,1fr)_100px_100px_100px_70px_40px] gap-2 px-2 text-xs text-muted-foreground">
                <div>Typ</div>
                <div>Bezeichnung</div>
                <div>Menge</div>
                <div className="text-right">EK (€)</div>
                <div className="text-right">VK (€)</div>
                <div className="text-right">MwSt</div>
                <div />
              </div>
              {fields.map((field, idx) => {
                const itemType = field.type;
                const ek = watch(`items.${idx}.unitCost`);
                return (
                  <div key={field.id} className="rounded-lg border p-2 space-y-2">
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
                          <p className="text-xs text-destructive">Pflichtfeld</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
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
                        {errors.items?.[idx]?.quantity && <p className="text-xs text-destructive">Pflichtfeld</p>}
                      </div>
                      <div className="h-8 flex items-center justify-end text-sm tabular-nums text-muted-foreground">
                        {ek != null ? formatCurrency(Number(ek)) : '—'}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Preis €"
                          {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                          className="h-8 text-sm text-right tabular-nums"
                        />
                        {errors.items?.[idx]?.unitPrice && <p className="text-xs text-destructive">Pflichtfeld</p>}
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="%"
                          disabled={isSmallBusiness}
                          {...register(`items.${idx}.taxRate`, { valueAsNumber: true })}
                          className="h-8 text-sm text-right tabular-nums"
                        />
                        {errors.items?.[idx]?.taxRate && <p className="text-xs text-destructive">Pflichtfeld</p>}
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

                    <div className="pl-1 flex items-center gap-2 flex-wrap">
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
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">Leistungsdatum:</span>
                      <Input
                        type="date"
                        className="h-7 w-36 text-xs"
                        {...register(`items.${idx}.serviceDate`)}
                      />
                    </div>
                  </div>
                );
              })}

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
    </ResourceFormLayout>
  );
}
