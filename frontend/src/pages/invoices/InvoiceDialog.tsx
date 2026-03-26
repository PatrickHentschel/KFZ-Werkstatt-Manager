import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { customersApi, type Customer } from '@/api/customers.api';
import { ordersApi } from '@/api/orders.api';
import { partsApi } from '@/api/parts.api';
import { staffApi } from '@/api/staff.api';
import { invoicesApi, type Invoice } from '@/api/invoices.api';
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

const invoiceSchema = z.object({
  type: z.enum(['invoice', 'quote', 'credit_note']),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  orderId: z.string().optional(),
  items: z.array(itemSchema),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const TYPE_LABEL: Record<string, string> = { labor: 'Arbeit', part: 'Teil', misc: 'Sonstiges' };

interface Props {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice;
}

export function InvoiceDialog({ open, onClose, invoice }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [partPickerIdx, setPartPickerIdx] = useState<number | null>(null);
  const [partPickerSearch, setPartPickerSearch] = useState('');
  const [debouncedPartSearch, setDebouncedPartSearch] = useState('');

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      type: 'invoice',
      issueDate: new Date().toISOString().split('T')[0],
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPartSearch(partPickerSearch), 300);
    return () => clearTimeout(timer);
  }, [partPickerSearch]);

  const selectedOrderId = watch('orderId');

  const { data: selectedOrderData } = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => ordersApi.getById(selectedOrderId!),
    enabled: !!selectedOrderId,
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCustomerSearch('');
      setSelectedCustomer(null);
      reset({
        type: 'invoice',
        issueDate: new Date().toISOString().split('T')[0],
        items: [],
      });
      setPartPickerIdx(null);
      setPartPickerSearch('');
    } else if (invoice) {
      setStep(2);
      setSelectedCustomer({
        ...(invoice.customer as any),
        type: invoice.customer?.companyName ? 'business' : 'private',
      });
      reset({
        type: invoice.type,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate || '',
        notes: invoice.notes || '',
        orderId: invoice.orderId || '',
        items: [...invoice.items]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(item => ({
            type: 'misc' as const,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
          })),
      });
    }
  }, [open, invoice, reset]);

  const { data: customersData } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => customersApi.list({ pageSize: 20, search: customerSearch || undefined }),
    enabled: step === 1,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { customerId: selectedCustomer?.id }],
    queryFn: () => ordersApi.list({ customerId: selectedCustomer!.id, pageSize: 50 } as any),
    enabled: step === 2 && !!selectedCustomer,
  });

  const { data: partsData } = useQuery({
    queryKey: ['parts', { search: debouncedPartSearch }],
    queryFn: () => partsApi.list({ search: debouncedPartSearch, pageSize: 20 }),
    enabled: debouncedPartSearch.length > 1,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
    enabled: step === 3,
  });

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
    if (!staff) return;
    if (staff.awRate) {
      setValue(`items.${idx}.unitPrice`, staff.awRate);
      setValue(`items.${idx}.unit`, 'AW');
    } else if (staff.hourlyRate) {
      setValue(`items.${idx}.unitPrice`, staff.hourlyRate);
      setValue(`items.${idx}.unit`, 'Std');
    }
  };

  const onMutationError = (err: any, fallback: string) =>
    toast({ variant: 'destructive', title: 'Fehler', description: err.response?.data?.message || fallback });

  const updateInvoiceMutation = useMutation({
    mutationFn: (data: InvoiceForm) =>
      invoicesApi.update(invoice!.id, {
        type: data.type,
        issueDate: data.issueDate,
        dueDate: data.dueDate || undefined,
        notes: data.notes,
        orderId: data.orderId || undefined,
        items: data.items.map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Rechnung aktualisiert' });
      onClose();
    },
    onError: (err: any) => onMutationError(err, 'Rechnung konnte nicht aktualisiert werden'),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: InvoiceForm) =>
      invoicesApi.create({
        customerId: selectedCustomer!.id,
        orderId: data.orderId || undefined,
        type: data.type,
        issueDate: data.issueDate,
        dueDate: data.dueDate || undefined,
        notes: data.notes,
        items: data.items.map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Rechnung erstellt' });
      onClose();
    },
    onError: (err: any) => onMutationError(err, 'Rechnung konnte nicht erstellt werden'),
  });

  const getCustomerName = (c: Customer) =>
    c.type === 'business'
      ? c.companyName || '—'
      : `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';

  const items = watch('items');
  const { totalNet, totalGross } = items.reduce(
    (acc: { totalNet: number; totalGross: number }, item: InvoiceForm['items'][number]) => {
      const net = (item.quantity || 0) * (item.unitPrice || 0);
      return { totalNet: acc.totalNet + net, totalGross: acc.totalGross + net * (1 + (item.taxRate || 0) / 100) };
    },
    { totalNet: 0, totalGross: 0 }
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold">{invoice ? 'Rechnung bearbeiten' : 'Neue Rechnung'}</Dialog.Title>
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
                      {s === 1 ? 'Kunde' : s === 2 ? 'Details' : 'Positionen'}
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

            {/* Step 2: Invoice details */}
            {step === 2 && (
              <div className="space-y-4">
                {selectedCustomer && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <span className="text-muted-foreground">Kunde: </span>
                    <span className="font-medium">{getCustomerName(selectedCustomer)}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="invoice-type">Typ</Label>
                    <select
                      id="invoice-type"
                      {...register('type')}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="invoice">Rechnung</option>
                      <option value="quote">Angebot</option>
                      <option value="credit_note">Gutschrift</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="issue-date">Ausstellungsdatum</Label>
                    <Input
                      id="issue-date"
                      type="date"
                      {...register('issueDate')}
                    />
                    {errors.issueDate && (
                      <p className="text-xs text-destructive">Pflichtfeld</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="due-date">Faelligkeitsdatum (optional)</Label>
                    <Input
                      id="due-date"
                      type="date"
                      {...register('dueDate')}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="invoice-notes">Notizen (optional)</Label>
                    <Input
                      id="invoice-notes"
                      placeholder="Interne Notizen..."
                      {...register('notes')}
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="order-link">Auftrag verknuepfen (optional)</Label>
                    <select
                      id="order-link"
                      {...register('orderId')}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Kein Auftrag</option>
                      {ordersData?.data.data.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber}{o.description ? ` — ${o.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Line items */}
            {step === 3 && (
              <div className="space-y-4">

                {/* Context summary */}
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Kunde: </span>
                  <span className="font-medium">{getCustomerName(selectedCustomer!)}</span>
                </div>

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
                          onClick={() => append({ type: t, description: '', quantity: 1, unitPrice: 0, taxRate: 20, unit: t === 'labor' ? 'AW' : undefined })}
                        >
                          <Plus className="mr-1 h-3 w-3" /> {TYPE_LABEL[t]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                      Noch keine Positionen — optional, koennen spaeter hinzugefuegt werden
                    </p>
                  )}

                  {fields.length > 0 && (
                    <div className="grid grid-cols-12 gap-1 px-2 pb-1">
                      <div className="col-span-2" />
                      <div className="col-span-3 text-xs text-muted-foreground">Bezeichnung</div>
                      <div className="col-span-2 text-xs text-muted-foreground">Menge</div>
                      <div className="col-span-2 text-xs text-muted-foreground">EP (€)</div>
                      <div className="col-span-2 text-xs text-muted-foreground">MwSt %</div>
                      <div className="col-span-1" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {fields.map((field, idx) => {
                      const itemType = field.type;
                      return (
                        <div key={field.id} className="rounded-lg border p-2 space-y-1">
                          <div className="grid grid-cols-12 gap-1 items-start">
                            <div className="col-span-2 pt-1">
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABEL[itemType]}
                              </Badge>
                            </div>
                            <div className="col-span-3 relative">
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Beschreibung"
                                  {...register(`items.${idx}.description`)}
                                  className="h-8 text-sm"
                                />
                                {itemType === 'part' && (
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
                                )}
                              </div>
                              {errors.items?.[idx]?.description && (
                                <p className="text-xs text-destructive">Pflichtfeld</p>
                              )}
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
                            <div className="col-span-2">
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
              onClick={() => {
                if (invoice && step === 2) {
                  onClose();
                } else {
                  step > 1 ? setStep((s: number) => s - 1) : onClose();
                }
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {step === 1 || (invoice && step === 2) ? 'Abbrechen' : 'Zurueck'}
            </Button>

            {step < 3 ? (
              <Button
                key="btn-next"
                type="button"
                disabled={step === 1 && !selectedCustomer}
                onClick={() => {
                  if (step === 2 && selectedOrderId && selectedOrderData?.data?.items?.length && fields.length === 0) {
                    replace(
                      [...selectedOrderData.data.items]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map(({ type, description, quantity, unitPrice, taxRate }) => ({
                          type, description, quantity, unitPrice, taxRate,
                        }))
                    );
                  }
                  setStep((s) => s + 1);
                }}
              >
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit((d) => invoice ? updateInvoiceMutation.mutate(d) : createInvoiceMutation.mutate(d))}
                disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
              >
                {(createInvoiceMutation.isPending || updateInvoiceMutation.isPending) ? 'Wird gespeichert...' : invoice ? 'Speichern' : 'Rechnung erstellen'}
              </Button>
            )}
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
