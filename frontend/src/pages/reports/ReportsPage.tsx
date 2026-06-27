import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, Clock, Package, ClipboardList, Users, Wrench, Euro,
  AlertTriangle, AlertCircle,
} from 'lucide-react';
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

function getMonthRange(offset = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    from: first.toISOString().split('T')[0],
    to: last.toISOString().split('T')[0],
  };
}

const PRESETS = [
  { label: 'Diesen Monat', range: () => getMonthRange(0) },
  { label: 'Letzten Monat', range: () => getMonthRange(-1) },
  {
    label: 'Dieses Jahr',
    range: () => {
      const now = new Date();
      return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split('T')[0] };
    },
  },
];

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      <span>Daten konnten nicht geladen werden.</span>
      <button
        onClick={onRetry}
        className="underline hover:no-underline ml-1 text-foreground"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

export function ReportsPage() {
  const [from, setFrom] = useState(() => getMonthRange(0).from);
  const [to, setTo] = useState(() => getMonthRange(0).to);
  const [customerSort, setCustomerSort] = useState<'revenue' | 'visits'>('revenue');

  const dateRangeValid = from <= to;

  const {
    data: revenueData, isLoading: isLoadingRevenue,
    isError: isErrorRevenue, refetch: refetchRevenue,
  } = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => reportsApi.getRevenue({ from, to }),
    enabled: dateRangeValid,
  });

  const {
    data: ordersData, isLoading: isLoadingOrders,
    isError: isErrorOrders, refetch: refetchOrders,
  } = useQuery({
    queryKey: ['reports', 'orders'],
    queryFn: () => reportsApi.getOrders(),
  });

  const {
    data: staffData, isLoading: isLoadingStaff,
    isError: isErrorStaff, refetch: refetchStaff,
  } = useQuery({
    queryKey: ['reports', 'staff', from, to],
    queryFn: () => reportsApi.getStaff({ from, to }),
    enabled: dateRangeValid,
  });

  const {
    data: partsData,
  } = useQuery({
    queryKey: ['reports', 'parts'],
    queryFn: () => reportsApi.getParts(),
  });

  const {
    data: topCustomersData, isLoading: isLoadingCustomers,
    isError: isErrorCustomers, refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['reports', 'top-customers', from, to],
    queryFn: () => reportsApi.getTopCustomers({ from, to, limit: 10 }),
    enabled: dateRangeValid,
  });

  const {
    data: breakdownData, isLoading: isLoadingBreakdown,
    isError: isErrorBreakdown, refetch: refetchBreakdown,
  } = useQuery({
    queryKey: ['reports', 'revenue-breakdown', from, to],
    queryFn: () => reportsApi.getRevenueBreakdown({ from, to }),
    enabled: dateRangeValid,
  });

  const revenue = revenueData?.data;
  const ordersReport = ordersData?.data;
  const staffReport = staffData?.data;
  const partsReport = partsData?.data;
  const breakdown = breakdownData?.data;
  const topCustomers: Array<{
    customerId: string; name: string; type: string; invoiceCount: number; totalNet: number;
  }> = topCustomersData?.data?.customers ?? [];

  const sortedCustomers = [...topCustomers].sort((a, b) =>
    customerSort === 'revenue' ? b.totalNet - a.totalNet : b.invoiceCount - a.invoiceCount
  );

  const breakdownTotal = (breakdown?.laborNet ?? 0) + (breakdown?.partsNet ?? 0) + (breakdown?.miscNet ?? 0);
  const barWidth = (val: number) => breakdownTotal > 0 ? Math.round((val / breakdownTotal) * 100) : 0;

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const r = preset.range();
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Berichte</h1>

      {/* Period selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Berichtszeitraum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="report-from">Von</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
                aria-invalid={!dateRangeValid}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to">Bis</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
                aria-invalid={!dateRangeValid}
              />
            </div>
          </div>
          {!dateRangeValid && (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3.5 w-3.5" />
              „Von" muss vor „Bis" liegen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Revenue summary — single card breaking the hero-metric pattern */}
      <Card>
        <CardContent className="pt-6">
          {isErrorRevenue ? (
            <QueryError onRetry={refetchRevenue} />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Bruttoumsatz</p>
                {isLoadingRevenue ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-10 w-44 rounded bg-muted" />
                    <div className="h-3.5 w-32 rounded bg-muted" />
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold tracking-tight">
                      {formatCurrency(revenue?.totalGross || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      inkl. MwSt. · {revenue?.invoiceCount || 0} bezahlte Rechnung{revenue?.invoiceCount !== 1 ? 'en' : ''}
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-6 pb-1">
                <div>
                  <p className="text-xs text-muted-foreground">Netto</p>
                  {isLoadingRevenue ? (
                    <div className="h-6 w-24 rounded bg-muted animate-pulse mt-0.5" />
                  ) : (
                    <p className="text-lg font-semibold">{formatCurrency(revenue?.totalNet || 0)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MwSt.</p>
                  {isLoadingRevenue ? (
                    <div className="h-6 w-20 rounded bg-muted animate-pulse mt-0.5" />
                  ) : (
                    <p className="text-lg font-semibold">{formatCurrency(revenue?.totalTax || 0)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            {isErrorBreakdown ? (
              <QueryError onRetry={refetchBreakdown} />
            ) : isLoadingBreakdown ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-4 w-40 rounded bg-muted" />
                    <div className="h-2.5 w-full rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5" /> Arbeitsleistung
                      </span>
                      <span className="font-medium">{formatCurrency(breakdown?.laborNet ?? 0)}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted">
                      <div
                        role="progressbar"
                        aria-label={`Arbeitsleistung: ${barWidth(breakdown?.laborNet ?? 0)}%`}
                        aria-valuenow={barWidth(breakdown?.laborNet ?? 0)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2.5 rounded-full bg-primary transition-all"
                        style={{ width: `${barWidth(breakdown?.laborNet ?? 0)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" /> Teile
                      </span>
                      <span className="font-medium">{formatCurrency(breakdown?.partsNet ?? 0)}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted">
                      <div
                        role="progressbar"
                        aria-label={`Teile: ${barWidth(breakdown?.partsNet ?? 0)}%`}
                        aria-valuenow={barWidth(breakdown?.partsNet ?? 0)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2.5 rounded-full bg-success transition-all"
                        style={{ width: `${barWidth(breakdown?.partsNet ?? 0)}%` }}
                      />
                    </div>
                  </div>
                  {(breakdown?.miscNet ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span>Sonstiges</span>
                        <span className="font-medium">{formatCurrency(breakdown!.miscNet)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted">
                        <div
                          role="progressbar"
                          aria-label={`Sonstiges: ${barWidth(breakdown!.miscNet)}%`}
                          aria-valuenow={barWidth(breakdown!.miscNet)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2.5 rounded-full bg-muted-foreground transition-all"
                          style={{ width: `${barWidth(breakdown!.miscNet)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Wareneinsatz (Teile EK)</span>
                    <span className="font-medium text-foreground">− {formatCurrency(breakdown?.costOfGoods ?? 0)}</span>
                  </div>
                  {(breakdown?.laborCost ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Personalkosten (Zeiterfassung)</span>
                      <span className="font-medium text-foreground">− {formatCurrency(breakdown!.laborCost)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rohgewinn</CardTitle>
            <Euro className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {isLoadingBreakdown ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-8 w-32 rounded bg-success/20" />
                <div className="h-3 w-24 rounded bg-success/20" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(breakdown?.grossProfit ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(breakdown?.laborCost ?? 0) > 0 ? 'vor Gemeinkosten' : 'vor Personalkosten & Gemeinkosten'}
                </p>
                {breakdownTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Marge: {Math.round(((breakdown?.grossProfit ?? 0) / breakdownTotal) * 100)}%
                  </p>
                )}
              </>
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
                variant={customerSort === 'revenue' ? 'secondary' : 'ghost'}
                aria-pressed={customerSort === 'revenue'}
                onClick={() => setCustomerSort('revenue')}
              >
                Nach Umsatz
              </Button>
              <Button
                size="sm"
                variant={customerSort === 'visits' ? 'secondary' : 'ghost'}
                aria-pressed={customerSort === 'visits'}
                onClick={() => setCustomerSort('visits')}
              >
                Nach Besuchen
              </Button>
            </div>
          </div>
          <CardDescription>Bezahlte Rechnungen im gewählten Zeitraum</CardDescription>
        </CardHeader>
        <CardContent>
          {isErrorCustomers ? (
            <QueryError onRetry={refetchCustomers} />
          ) : isLoadingCustomers ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded bg-muted" />
                    <div className="h-4 w-32 rounded bg-muted" />
                  </div>
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : sortedCustomers.length === 0 ? (
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
        {/* Order status breakdown — not date-filtered */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Aufträge nach Status
            </CardTitle>
            <CardDescription>Alle Aufträge, zeitraumunabhängig</CardDescription>
          </CardHeader>
          <CardContent>
            {isErrorOrders ? (
              <QueryError onRetry={refetchOrders} />
            ) : isLoadingOrders ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-5 w-8 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
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
            )}
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
            {isErrorStaff ? (
              <QueryError onRetry={refetchStaff} />
            ) : isLoadingStaff ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-4 w-12 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {staffReport?.staff?.map((s: any) => (
                  <div key={s.staffId} className="flex items-center justify-between rounded-lg border p-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {(s.totalMinutes / 60).toFixed(1)}h
                      </div>
                      <div className="text-xs text-muted-foreground">{s.entryCount} Einträge</div>
                    </div>
                  </div>
                ))}
                {!staffReport?.staff?.length && (
                  <p className="text-sm text-muted-foreground">Keine Zeiterfassung im Zeitraum</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock warning — not date-filtered, current inventory */}
      {partsReport?.lowStockCount > 0 && (
        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Mindestbestand unterschritten ({partsReport.lowStockCount} Teile)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {partsReport.lowStockItems?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    {p.name} <span className="text-muted-foreground font-mono">({p.sku})</span>
                  </span>
                  <span className="text-warning font-medium">
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
