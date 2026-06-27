import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { X, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ordersApi, type TimeEntryWithStaff, type OrderStatus } from '@/api/orders.api';
import { staffApi } from '@/api/staff.api';
import { settingsApi } from '@/api/settings.api';
import { toast } from '@/hooks/use-toast';

interface Props {
  orderId: string | null;
  onClose: () => void;
}

type Tab = 'overview' | 'time';

const TYPE_LABEL: Record<string, string> = { labor: 'Arbeit', part: 'Teil', misc: 'Sonstiges' };
const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  labor: 'default',
  part: 'secondary',
  misc: 'outline',
};

const statusLabel: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting_parts: 'Warte auf Teile',
  done: 'Fertig',
  invoiced: 'Verrechnet',
};

const statusVariant: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'outline'> = {
  open: 'secondary',
  in_progress: 'default',
  waiting_parts: 'warning',
  done: 'success',
  invoiced: 'outline',
};

// Spiegelt backend STATUS_TRANSITIONS. Identitäts-Übergänge sind no-op.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: ['in_progress', 'waiting_parts'],
  in_progress: ['waiting_parts', 'done'],
  waiting_parts: ['in_progress', 'done'],
  done: ['invoiced', 'in_progress'],
  invoiced: [],
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function StaffDot({ color }: { color?: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: color || 'oklch(var(--muted-foreground))' }}
    />
  );
}

export function OrderDetailSheet({ orderId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryWithStaff | null>(null);
  // Entries already converted to a labor position this session — prevents double-billing.
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [entryError, setEntryError] = useState<string | null>(null);

  // Time entry form state
  const [newStaffId, setNewStaffId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newMinutes, setNewMinutes] = useState('');

  const isOpen = !!orderId;

  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersApi.getById(orderId!),
    enabled: !!orderId,
  });

  const { data: timeEntriesData, isLoading: timeLoading } = useQuery({
    queryKey: ['orders', orderId, 'time-entries'],
    queryFn: () => ordersApi.getTimeEntries(orderId!),
    enabled: !!orderId,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
    enabled: !!orderId,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
    enabled: !!orderId,
  });

  const addTimeEntryMutation = useMutation({
    mutationFn: (data: { staffId: string; description?: string; durationMinutes: number }) =>
      ordersApi.addTimeEntry(orderId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'time-entries'] });
      toast({ title: 'Zeiterfassung hinzugefügt' });
      setEntryError(null);
      setNewStaffId('');
      setNewDescription('');
      setNewHours('');
      setNewMinutes('');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Zeiterfassung konnte nicht gespeichert werden',
      });
    },
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: ({ staffId, entryId }: { staffId: string; entryId: string }) =>
      staffApi.deleteTimeEntry(staffId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'time-entries'] });
      toast({ title: 'Eintrag gelöscht' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Eintrag konnte nicht geloscht werden',
      });
    },
    onSettled: () => setDeleteEntry(null),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.updateStatus(orderId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
      toast({ title: 'Status aktualisiert' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Status konnte nicht geändert werden',
      });
    },
  });

  const convertEntryMutation = useMutation({
    mutationFn: async (entry: TimeEntryWithStaff) => {
      const order = orderData!.data;
      const durationMinutes = entry.durationMinutes || 0;
      const awRate = Number(settingsData?.data.awRate || 0);
      const hourlyRate = Number(entry.staff.hourlyRate || 0);
      const useAw = awRate > 0;
      const awMinutes = settingsData?.data.awMinutes ?? 5;
      const quantity = useAw
        ? Math.round(durationMinutes / awMinutes * 10) / 10
        : Math.round(durationMinutes / 60 * 100) / 100;
      const unitPrice = useAw ? awRate : hourlyRate;
      const currentItems = order.items.map((item) => ({
        type: item.type,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        unit: item.unit || undefined,
        partId: item.partId || undefined,
        sortOrder: item.sortOrder,
      }));
      const isSmallBusiness = !!settingsData?.data.isSmallBusiness;
      const defaultTaxRate = isSmallBusiness ? 0 : Number(settingsData?.data.taxRate ?? 19);
      const newItem = {
        type: 'labor' as const,
        description: `${entry.staff.firstName} ${entry.staff.lastName}${entry.description ? ` – ${entry.description}` : ''}`,
        quantity,
        unitPrice,
        taxRate: defaultTaxRate,
        unit: useAw ? 'AW' : 'Std',
        sortOrder: currentItems.length,
      };
      await ordersApi.updateItems(orderId!, [...currentItems, newItem]);
    },
    onSuccess: (_data, entry) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Arbeitsposition übernommen' });
      setConvertedIds((prev) => new Set(prev).add(entry.id));
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Konnte nicht übernommen werden',
      });
    },
  });

  const handleAddTimeEntry = () => {
    const h = parseInt(newHours || '0', 10);
    const m = parseInt(newMinutes || '0', 10);
    const totalMinutes = h * 60 + m;
    if (!newStaffId) {
      setEntryError('Bitte Mitarbeiter auswählen');
      return;
    }
    if (totalMinutes <= 0) {
      setEntryError('Bitte Dauer eingeben');
      return;
    }
    setEntryError(null);
    addTimeEntryMutation.mutate({
      staffId: newStaffId,
      description: newDescription || undefined,
      durationMinutes: totalMinutes,
    });
  };

  const order = orderData?.data;
  const timeEntries: TimeEntryWithStaff[] = timeEntriesData?.data ?? [];
  const staffList = staffData?.data.data ?? [];

  const totalNet = (order?.items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );
  const totalGross = (order?.items ?? []).reduce((sum, item) => {
    const net = Number(item.quantity) * Number(item.unitPrice);
    return sum + net * (1 + Number(item.taxRate) / 100);
  }, 0);

  const assignedStaff = order?.assignedStaffId
    ? staffList.find((s) => s.id === order.assignedStaffId)
    : null;

  const customerName = order?.customer
    ? (order.customer.companyName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || '—')
    : '—';

  return (
    <>
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed right-0 top-0 h-full w-full max-w-[820px] bg-background shadow-xl z-50 flex flex-col overflow-hidden focus:outline-none"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b shrink-0">
            <div className="space-y-1 min-w-0">
              {orderLoading ? (
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              ) : order ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Dialog.Title className="text-base font-semibold font-mono">
                      {order.orderNumber}
                    </Dialog.Title>
                    <Badge variant={statusVariant[order.status]}>
                      {statusLabel[order.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {customerName}
                    {order.vehicle && (
                      <span className="ml-2 font-mono text-foreground">{order.vehicle.licensePlate}</span>
                    )}
                    {order.vehicle && (
                      <span className="ml-1 text-muted-foreground">
                        — {order.vehicle.make} {order.vehicle.model}
                      </span>
                    )}
                  </p>
                </>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="shrink-0 ml-2">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <Tabs.List className="flex border-b shrink-0">
              {([
                { id: 'overview' as Tab, label: 'Übersicht' },
                { id: 'time' as Tab, label: 'Zeiterfassung' },
              ] as const).map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className="border-b-2 border-transparent px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[state=active]:border-primary data-[state=active]:text-foreground"
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
            {orderLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            ) : !order ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Auftrag nicht gefunden</div>
            ) : (
              <>
                {/* Overview Tab */}
                <Tabs.Content value="overview" className="focus:outline-none">
                  <div className="p-5 space-y-5">
                    {/* Status-Switcher: alle erlaubten Übergänge als Buttons */}
                    {ALLOWED_TRANSITIONS[order.status as OrderStatus].length > 0 && (
                      <div className="rounded-lg border p-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground shrink-0">Status ändern:</span>
                        {ALLOWED_TRANSITIONS[order.status as OrderStatus].map((target) => (
                          <Button
                            key={target}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={updateStatusMutation.isPending}
                            onClick={() => updateStatusMutation.mutate(target)}
                          >
                            → {statusLabel[target]}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Order info */}
                    <div className="rounded-lg border p-4 space-y-2 text-sm">
                      {order.description && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">Beschreibung</span>
                          <span>{order.description}</span>
                        </div>
                      )}
                      {order.mileageIn && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">Km Eingang</span>
                          <span>{order.mileageIn.toLocaleString('de-DE')} km</span>
                        </div>
                      )}
                      {order.notes && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">Notizen</span>
                          <span>{order.notes}</span>
                        </div>
                      )}
                      {assignedStaff && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">Zuständig</span>
                          <span className="flex items-center gap-1.5">
                            <StaffDot color={assignedStaff.color} />
                            {assignedStaff.firstName} {assignedStaff.lastName}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">Erstellt</span>
                        <span>{new Date(order.createdAt).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>

                    {/* Items table */}
                    {order.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                        Keine Positionen vorhanden
                      </p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full min-w-[440px] text-sm">
                          <thead className="bg-muted/50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Typ</th>
                              <th className="px-3 py-2 text-left font-medium">Beschreibung</th>
                              <th className="px-3 py-2 text-right font-medium">Menge</th>
                              <th className="px-3 py-2 text-right font-medium">EP (netto)</th>
                              <th className="px-3 py-2 text-right font-medium">Gesamt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {order.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-2">
                                  <Badge variant={TYPE_VARIANT[item.type]} className="text-xs">
                                    {TYPE_LABEL[item.type]}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">{item.description}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {Number(item.quantity).toLocaleString('de-DE')}
                                  {item.unit && <span className="ml-1 text-muted-foreground text-xs">{item.unit}</span>}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {Number(item.unitPrice).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('de-DE', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        <div className="px-3 py-2 border-t bg-muted/30 flex justify-end gap-6 text-sm">
                          <span className="text-muted-foreground">
                            Netto:{' '}
                            <span className="font-medium text-foreground">
                              {totalNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            Brutto:{' '}
                            <span className="font-medium text-foreground">
                              {totalGross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Tabs.Content>

                {/* Time tracking Tab */}
                <Tabs.Content value="time" className="focus:outline-none">
                  <div className="p-5 space-y-5">
                    {/* Existing entries */}
                    {timeLoading ? (
                      <div className="text-sm text-muted-foreground text-center py-4">Wird geladen...</div>
                    ) : timeEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                        Keine Zeiterfassungen vorhanden
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {timeEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border p-3 flex items-start gap-3"
                          >
                            <StaffDot color={entry.staff.color} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {entry.staff.firstName} {entry.staff.lastName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.startTime).toLocaleDateString('de-DE')}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(entry.durationMinutes || 0)}
                                </span>
                              </div>
                              {entry.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {entry.description}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => convertEntryMutation.mutate(entry)}
                                disabled={
                                  convertEntryMutation.isPending ||
                                  convertedIds.has(entry.id) ||
                                  order.status === 'invoiced'
                                }
                                title={
                                  order.status === 'invoiced'
                                    ? 'Auftrag verrechnet — Positionen gesperrt'
                                    : 'Als Arbeitsposition übernehmen'
                                }
                              >
                                {convertedIds.has(entry.id) ? 'Übernommen' : 'Übernehmen'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteEntry(entry)}
                                disabled={deleteTimeEntryMutation.isPending}
                                aria-label="Zeiteintrag löschen"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new time entry */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm font-medium">Zeiterfassung hinzufügen</p>
                      <div className="space-y-1">
                        <Label className="text-xs">Mitarbeiter</Label>
                        <select
                          value={newStaffId}
                          onChange={(e) => setNewStaffId(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">— Mitarbeiter wählen —</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Beschreibung (optional)</Label>
                        <Input
                          placeholder="z.B. Olwechsel, Bremsinspektion..."
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dauer</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={newHours}
                              onChange={(e) => setNewHours(e.target.value)}
                              className="h-8 w-20 text-sm"
                            />
                            <span className="text-sm text-muted-foreground">h</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="0"
                              value={newMinutes}
                              onChange={(e) => setNewMinutes(e.target.value)}
                              className="h-8 w-20 text-sm"
                            />
                            <span className="text-sm text-muted-foreground">min</span>
                          </div>
                        </div>
                      </div>
                      {entryError && <p className="text-xs text-destructive">{entryError}</p>}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddTimeEntry}
                        disabled={addTimeEntryMutation.isPending}
                        className="w-full"
                      >
                        {addTimeEntryMutation.isPending ? 'Wird gespeichert...' : 'Hinzufügen'}
                      </Button>
                    </div>
                  </div>
                </Tabs.Content>
              </>
            )}
            </div>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <AlertDialog
      open={!!deleteEntry}
      onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zeiteintrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteEntry && (
              <>
                {deleteEntry.staff.firstName} {deleteEntry.staff.lastName} ·{' '}
                {formatDuration(deleteEntry.durationMinutes || 0)}. Dies kann nicht rückgängig gemacht werden.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteEntry(null)}
            disabled={deleteTimeEntryMutation.isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteEntry && deleteTimeEntryMutation.mutate({ staffId: deleteEntry.staffId, entryId: deleteEntry.id })}
            disabled={deleteTimeEntryMutation.isPending}
          >
            {deleteTimeEntryMutation.isPending ? 'Wird gelöscht...' : 'Löschen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
