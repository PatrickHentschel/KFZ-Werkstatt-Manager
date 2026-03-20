import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Clock, Package, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  const revenue = revenueData?.data;
  const ordersReport = ordersData?.data;
  const staffReport = staffData?.data;
  const partsReport = partsData?.data;

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
