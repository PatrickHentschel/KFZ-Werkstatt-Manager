import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Users, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { customersApi } from '@/api/customers.api';
import { ordersApi } from '@/api/orders.api';
import { invoicesApi } from '@/api/invoices.api';

export function DashboardPage() {
  const { data: customers } = useQuery({
    queryKey: ['customers', 'count'],
    queryFn: () => customersApi.list({ pageSize: 1 }),
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => ordersApi.list({ pageSize: 5, statuses: 'open,in_progress,waiting_parts,done' }),
  });

  const { data: openOrders } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersApi.list({ pageSize: 1, status: 'open' }),
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'recent'],
    queryFn: () => invoicesApi.list({ pageSize: 5, statuses: 'draft,sent' }),
  });

  const orderStatusColor: Record<string, string> = {
    open: 'secondary',
    in_progress: 'default',
    waiting_parts: 'warning',
    done: 'success',
    invoiced: 'outline',
  };

  const orderStatusLabel: Record<string, string> = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    waiting_parts: 'Warte auf Teile',
    done: 'Fertig',
    invoiced: 'Verrechnet',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers?.data.total || 0}</div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Aufträge</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openOrders?.data.total || 0}</div>
            <p className="text-xs text-muted-foreground">Aktiv</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aufträge gesamt</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders?.data.total || 0}</div>
            <p className="text-xs text-muted-foreground">Alle Status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechnungen</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices?.data.total || 0}</div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Aktuelle Aufträge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders?.data.data.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Aufträge vorhanden</p>
              )}
              {orders?.data.data.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.vehicle?.licensePlate} — {order.vehicle?.make} {order.vehicle?.model}
                    </p>
                  </div>
                  <Badge variant={orderStatusColor[order.status] as any}>
                    {orderStatusLabel[order.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Aktuelle Rechnungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices?.data.data.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Rechnungen vorhanden</p>
              )}
              {invoices?.data.data.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{invoice.issueDate}</p>
                  </div>
                  <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'sent' ? 'default' : 'secondary'}>
                    {invoice.status === 'draft' ? 'Entwurf' : invoice.status === 'sent' ? 'Versendet' : invoice.status === 'paid' ? 'Bezahlt' : 'Storniert'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
