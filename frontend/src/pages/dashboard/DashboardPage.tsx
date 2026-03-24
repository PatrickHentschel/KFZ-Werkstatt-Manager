import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dashboardApi } from '@/api/dashboard.api';

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

const invoiceStatusLabel: Record<string, string> = {
  draft: 'Entwurf', sent: 'Versendet', paid: 'Bezahlt', cancelled: 'Storniert',
};

const invoiceStatusVariant: Record<string, string> = {
  draft: 'secondary', sent: 'default', paid: 'success', cancelled: 'destructive',
};

const formatEur = (amount: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount);

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded-lg" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-destructive">Dashboard-Daten konnten nicht geladen werden.</p>
      </div>
    );
  }

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
            <div className="text-2xl font-bold">{stats?.totalCustomers ?? '—'}</div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Aufträge</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openOrders ?? '—'}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.ordersCompletedThisMonth ?? 0} diesen Monat fertig
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Umsatz diesen Monat</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats !== undefined ? formatEur(stats.revenueThisMonth) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Vormonat: {stats !== undefined ? formatEur(stats.revenueLastMonth) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Überfällige Rechnungen</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats?.overdueInvoices ?? 0) > 0 ? 'text-destructive' : ''}`}>
              {stats?.overdueInvoices ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">Zahlungsziel überschritten</p>
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
              {stats?.recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Aufträge vorhanden</p>
              )}
              {stats?.recentOrders.map((order) => (
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
              {stats?.recentInvoices.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Rechnungen vorhanden</p>
              )}
              {stats?.recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.issueDate).toLocaleDateString('de-AT')}
                    </p>
                  </div>
                  <Badge variant={invoiceStatusVariant[invoice.status] as any}>
                    {invoiceStatusLabel[invoice.status]}
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
