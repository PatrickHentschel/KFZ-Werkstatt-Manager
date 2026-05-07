import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ordersApi, type Order, type OrderStatus } from '@/api/orders.api';
import { toast } from '@/hooks/use-toast';
import { OrderDialog } from './OrderDialog';
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
  done: 'invoiced',
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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | OrderStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Rechnung erstellt' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message,
      });
    },
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
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Neuer Auftrag
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Wird geladen...</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Keine Aufträge vorhanden</div>
          ) : (
            <table className="w-full">
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
                      <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
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
                        className="px-4 py-3 text-right space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.status === 'done' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => createInvoiceMutation.mutate(o.id)}
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

      <OrderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <OrderDetailSheet orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
}
