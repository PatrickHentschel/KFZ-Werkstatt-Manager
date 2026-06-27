import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ordersApi, type Order, type OrderStatus } from '@/api/orders.api';
import { toast } from '@/hooks/use-toast';
import { OrderDetailSheet } from './OrderDetailSheet';

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

// One-step forward transition per status; null means terminal (no action shown)
const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  open: 'in_progress',
  in_progress: 'done',
  waiting_parts: 'in_progress',
  done: null,
  invoiced: null,
};

const nextStatusLabel: Record<string, string> = {
  open: '→ In Bearbeitung',
  in_progress: '→ Fertig',
  waiting_parts: '→ In Bearbeitung',
  done: '→ Verrechnen',
};

const tabs: { label: string; value: 'all' | OrderStatus }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Offen', value: 'open' },
  { label: 'In Bearbeitung', value: 'in_progress' },
  { label: 'Warte auf Teile', value: 'waiting_parts' },
  { label: 'Fertig', value: 'done' },
  { label: 'Verrechnet', value: 'invoiced' },
];

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | OrderStatus>('all');
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [invoiceConfirm, setInvoiceConfirm] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, search, activeTab }],
    queryFn: () => ordersApi.list({
      page,
      pageSize: 20,
      search: search || undefined,
      status: activeTab !== 'all' ? activeTab : undefined,
    }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (id: string) => ordersApi.createInvoice(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/invoices/${res.data.id}/edit`);
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message,
      });
    },
    onSettled: () => setInvoiceConfirm(null),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Status aktualisiert' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message,
      });
    },
  });

  const orders = data?.data.data ?? [];
  const totalPages = data?.data.totalPages ?? 1;
  const isFiltered = Boolean(search) || activeTab !== 'all';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Aufträge</h1>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Aufträge suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => navigate('/orders/new')}>
          <Plus className="mr-2 h-4 w-4" /> Neuer Auftrag
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="h-4 w-24 shrink-0 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-4 flex-1 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                  <div className="h-5 w-20 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            isFiltered ? (
              <EmptyState
                icon={Search}
                title="Keine Treffer"
                body="Keine Aufträge passen zu Suche oder Filter. Andere Eingabe probieren."
              />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="Noch keine Aufträge"
                body="Lege deinen ersten Auftrag an, um Fahrzeuge durch die Werkstatt zu verfolgen."
                ctaLabel="Neuer Auftrag"
                ctaTo="/orders/new"
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Auftragsnr.</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Fahrzeug</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Kunde</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Erstellt</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o: Order) => {
                    const next = nextStatus[o.status];
                    const customerName = o.customer
                      ? (o.customer.companyName || `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim())
                      : '—';
                    return (
                      <tr
                        key={o.id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => setDetailOrderId(o.id)}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={(e) => { e.stopPropagation(); setDetailOrderId(o.id); }}
                          >
                            {o.orderNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {o.vehicle
                            ? `${o.vehicle.licensePlate} — ${o.vehicle.make} ${o.vehicle.model}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">{customerName || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[o.status]}>
                            {statusLabel[o.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString('de-DE')}
                        </td>
                        <td
                          className="px-4 py-3 text-right space-x-2 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/orders/${o.id}/edit`)}
                            title="Bearbeiten"
                            aria-label={`Auftrag ${o.orderNumber} bearbeiten`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {o.status === 'done' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setInvoiceConfirm(o)}
                              disabled={createInvoiceMutation.isPending}
                            >
                              Rechnung erstellen
                            </Button>
                          )}
                          {next && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: o.id, status: next })}
                              disabled={updateStatusMutation.isPending}
                            >
                              {nextStatusLabel[o.status]}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Zurück
          </Button>
          <span className="flex items-center text-sm">Seite {page} von {totalPages}</span>
          <Button variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Weiter
          </Button>
        </div>
      )}

      <OrderDetailSheet orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />

      <AlertDialog
        open={!!invoiceConfirm}
        onOpenChange={(open) => { if (!open) setInvoiceConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechnung erstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Für Auftrag {invoiceConfirm?.orderNumber} wird ein Rechnungsentwurf erstellt und geöffnet.
              Der Auftrag wird als verrechnet markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvoiceConfirm(null)}
              disabled={createInvoiceMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => invoiceConfirm && createInvoiceMutation.mutate(invoiceConfirm.id)}
              disabled={createInvoiceMutation.isPending}
            >
              {createInvoiceMutation.isPending ? 'Wird erstellt...' : 'Rechnung erstellen'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
