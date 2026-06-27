import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList, AlertTriangle, ArrowUpRight, ArrowDownRight,
  CheckCircle2, FileText, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { dashboardApi } from '@/api/dashboard.api';

const orderStatusVariant: Record<string, string> = {
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
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// KPI tiles are real, keyboard-focusable links so a glanced number is one click from its detail.
function KpiCard({ to, span, cardClassName, children }: {
  to: string; span?: boolean; cardClassName?: string; children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'block rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        span && 'sm:col-span-2',
      )}
    >
      <Card className={cn('h-full transition-colors hover:border-primary/40', cardClassName)}>
        {children}
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse rounded-lg bg-muted" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.data;
  if (isError || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-sm font-medium">Dashboard-Daten konnten nicht geladen werden.</p>
            <p className="text-xs text-muted-foreground">Prüfe deine Verbindung und versuche es erneut.</p>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orders = stats.recentOrders ?? [];
  const invoices = stats.recentInvoices ?? [];

  const hasOverdue = stats.overdueInvoices > 0;
  const showDelta = stats.revenueLastMonth > 0;
  const deltaPct = showDelta
    ? Math.round(((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100)
    : 0;
  const up = deltaPct >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Aktualisiert {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: de })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Daten aktualisieren"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Link
            to="/customers"
            className="rounded text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {stats.totalCustomers} Kunden
          </Link>
        </div>
      </div>

      {/* KPIs — revenue leads, overdue flags itself when it needs action, vanity counts demoted */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard to="/reports" span>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Umsatz diesen Monat</CardTitle>
            {showDelta && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium', up ? 'text-success' : 'text-warning')}>
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {up ? '+' : '−'}{Math.abs(deltaPct)} % vs. Vormonat
              </span>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{formatEur(stats.revenueThisMonth)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Vormonat: {formatEur(stats.revenueLastMonth)}</p>
          </CardContent>
        </KpiCard>

        <KpiCard to="/orders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Aufträge</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.openOrders}</div>
            <p className="mt-1 text-xs text-muted-foreground">{stats.ordersCompletedThisMonth} diesen Monat fertig</p>
          </CardContent>
        </KpiCard>

        <KpiCard
          to="/invoices"
          cardClassName={hasOverdue ? 'border-destructive/40 bg-destructive/5 hover:border-destructive/60' : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Überfällige Rechnungen</CardTitle>
            {hasOverdue
              ? <AlertTriangle className="h-4 w-4 text-destructive" />
              : <CheckCircle2 className="h-4 w-4 text-success" />}
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums', hasOverdue && 'text-destructive')}>
              {stats.overdueInvoices}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasOverdue ? 'Zahlungsziel überschritten' : 'Alles bezahlt'}
            </p>
          </CardContent>
        </KpiCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Aktuelle Aufträge</CardTitle>
            {orders.length > 0 && (
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/orders">Alle anzeigen</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Noch keine Aufträge"
                body="Neue Aufträge erscheinen hier, sobald du sie anlegst."
                ctaLabel="Auftrag anlegen"
                ctaTo="/orders/new"
              />
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}/edit`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.vehicle
                          ? `${order.vehicle.licensePlate} — ${order.vehicle.make} ${order.vehicle.model}`
                          : 'Kein Fahrzeug'}
                      </p>
                    </div>
                    <Badge variant={(orderStatusVariant[order.status] ?? 'secondary') as any} className="shrink-0">
                      {orderStatusLabel[order.status] ?? order.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Aktuelle Rechnungen</CardTitle>
            {invoices.length > 0 && (
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/invoices">Alle anzeigen</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Noch keine Rechnungen"
                body="Erstellte Rechnungen erscheinen hier und lassen sich von hier öffnen."
                ctaLabel="Rechnung erstellen"
                ctaTo="/invoices/new"
              />
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/invoices/${invoice.id}/edit`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(invoice.issueDate).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <Badge variant={(invoiceStatusVariant[invoice.status] ?? 'secondary') as any} className="shrink-0">
                      {invoiceStatusLabel[invoice.status] ?? invoice.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
