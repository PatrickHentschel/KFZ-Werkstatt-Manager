import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Clock, Package, ClipboardList, Users, Wrench, Euro } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { reportsApi } from '@/api/reports.api';
import { formatCurrency } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting_parts: 'Warte auf Teile',
  done: 'Fertig',
  invoiced: 'Verrechnet',
};

export function ReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerSort, setCustomerSort] = useState<'revenue' | 'visits'>('revenue');

  const { data: revenueData } = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => reportsApi.getRevenue({ from, to }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['reports', 'orders'],
    queryFn: () => reportsApi.getOrders(),
  });

  const { data: staffData } = useQuery({
    queryKey: ['reports', 'staff', from, to],
    queryFn: () => reportsApi.getStaff({ from, to }),
  });

  const { data: partsData } = useQuery({
    queryKey: ['reports', 'parts'],
    queryFn: () => reportsApi.getParts(),
  });

  const { data: topCustomersData } = useQuery({
    queryKey: ['reports', 'top-customers', from, to],
    queryFn: () => reportsApi.getTopCustomers({ from, to, limit: 10 }),
  });

  const { data: breakdownData } = useQuery({
    queryKey: ['reports', 'revenue-breakdown', from, to],
    queryFn: () => reportsApi.getRevenueBreakdown({ from, to }),
  });

  const revenue = revenueData?.data;
  const ordersReport = ordersData?.data;
  const staffReport = staffData?.data;
  const partsReport = partsData?.data;
  const breakdown = breakdownData?.data;
  const topCustomers: Array<{ customerId: string; name: string; type: string; invoiceCount: number; totalNet: number }> =
    topCustomersData?.data?.customers ?? [];

  const sortedCustomers = [...topCustomers].sort((a, b) =>
    customerSort === 'revenue' ? b.totalNet - a.totalNet : b.invoiceCount - a.invoiceCount
  );

  const breakdownTotal = (breakdown?.laborNet ?? 0) + (breakdown?.partsNet ?? 0) + (breakdown?.miscNet ?? 0);
  const barWidth = (val: number) => breakdownTotal > 0 ? Math.round((val / breakdownTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Berichte</h1>

      {/* Period selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Von</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Bis</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nettoumsatz</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenue?.totalNet || 0)}</div>
            <p className="text-xs text-muted-foreground">{revenue?.invoiceCount || 0} bezahlte Rechnungen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MwSt.</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenue?.totalTax || 0)}</div>
            <p className="text-xs text-muted-foreground">Umsatzsteuer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bruttoumsatz</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenue?.totalGross || 0)}</div>
            <p className="text-xs text-muted-foreground">inkl. MwSt.</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown: labor vs parts + gross profit */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Umsatz-Aufschlüsselung
            </CardTitle>
            <CardDescription>Anteil Arbeitsleistung vs. Teile im gewählten Zeitraum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Arbeitsleistung</span>
                  <span className="font-medium">{formatCurrency(breakdown?.laborNet ?? 0)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${barWidth(breakdown?.laborNet ?? 0)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Teile</span>
                  <span className="font-medium">{formatCurrency(breakdown?.partsNet ?? 0)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${barWidth(breakdown?.partsNet ?? 0)}%` }} />
                </div>
              </div>
              {(breakdown?.miscNet ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span>Sonstiges</span>
                    <span className="font-medium">{formatCurrency(breakdown.miscNet)}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div className="h-2.5 rounded-full bg-gray-400" style={{ width: `${barWidth(breakdown.miscNet)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t pt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>Wareneinsatz (Teile EK)</span>
              <span className="font-medium text-foreground">− {formatCurrency(breakdown?.costOfGoods ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Rohgewinn</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(breakdown?.grossProfit ?? 0)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              vor Personalkosten &amp; Gemeinkosten
            </p>
            {breakdownTotal > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                Marge: {Math.round(((breakdown?.grossProfit ?? 0) / breakdownTotal) * 100)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top customers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Top Kunden
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={customerSort === 'revenue' ? 'default' : 'outline'}
                onClick={() => setCustomerSort('revenue')}
              >
                Nach Umsatz
              </Button>
              <Button
                size="sm"
                variant={customerSort === 'visits' ? 'default' : 'outline'}
                onClick={() => setCustomerSort('visits')}
              >
                Nach Besuchen
              </Button>
            </div>
          </div>
          <CardDescription>Bezahlte Rechnungen im gewählten Zeitraum</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum</p>
          ) : (
            <div className="space-y-2">
              {sortedCustomers.map((c, idx) => (
                <div key={c.customerId} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-5 text-right">{idx + 1}</span>
                    <div>
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {c.type === 'business' ? 'Firma' : 'Privat'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(c.totalNet)}</div>
                    <div className="text-xs text-muted-foreground">{c.invoiceCount} Rechnung{c.invoiceCount !== 1 ? 'en' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Order status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Aufträge nach Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ordersReport?.statusCounts?.map((row: any) => (
                <div key={row.status} className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm">{STATUS_LABEL[row.status] || row.status}</span>
                  <Badge variant="secondary">{row.count}</Badge>
                </div>
              ))}
              {!ordersReport?.statusCounts?.length && (
                <p className="text-sm text-muted-foreground">Keine Daten</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Staff hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Mitarbeiterstunden
            </CardTitle>
            <CardDescription>Im gewählten Zeitraum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {staffReport?.staff?.map((s: any) => (
                <div key={s.staffId} className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {Math.round((s.totalMinutes / 60) * 10) / 10}h
                    </div>
                    <div className="text-xs text-muted-foreground">{s.entryCount} Einträge</div>
                  </div>
                </div>
              ))}
              {!staffReport?.staff?.length && (
                <p className="text-sm text-muted-foreground">Keine Zeiterfassung im Zeitraum</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock warning */}
      {partsReport?.lowStockCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Package className="h-5 w-5" /> Mindestbestand unterschritten ({partsReport.lowStockCount} Teile)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {partsReport.lowStockItems?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    {p.name} <span className="text-muted-foreground font-mono">({p.sku})</span>
                  </span>
                  <span className="text-orange-700 font-medium">
                    {p.stockQuantity} / {p.minStock} (min)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
