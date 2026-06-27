import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api';
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/locale';

function customerName(c: Vehicle['customer']): string {
  if (!c) return '—';
  return c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
}

export function VehiclesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', { page, search }],
    queryFn: () => vehiclesApi.list({ page, pageSize: 20, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Fahrzeug gelöscht' });
    },
    onError: () => {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    },
  });

  const vehicles = data?.data.data ?? [];
  const totalPages = data?.data.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fahrzeuge</h1>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Fahrzeuge suchen"
            placeholder="Fahrzeuge suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => navigate('/vehicles/new')}>
          <Plus className="mr-2 h-4 w-4" /> Neues Fahrzeug
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y" aria-busy="true" aria-label="Wird geladen">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-4 py-3 animate-pulse">
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="ml-auto h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Car className="h-10 w-10 text-muted-foreground/30" />
              {search ? (
                <>
                  <p className="text-sm font-medium text-foreground">Keine Ergebnisse für „{search}"</p>
                  <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                    Suche zurücksetzen
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Noch keine Fahrzeuge erfasst</p>
                  <Button size="sm" onClick={() => navigate('/vehicles/new')}>
                    <Plus className="mr-2 h-4 w-4" /> Erstes Fahrzeug anlegen
                  </Button>
                </>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kunde</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kennzeichen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fahrzeug</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">KM-Stand</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">FIN</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.map((v: Vehicle) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{customerName(v.customer)}</td>
                    <td className="px-4 py-3 font-mono font-medium">{v.licensePlate}</td>
                    <td className="px-4 py-3 text-sm">
                      {v.firstRegistration && (
                        <span className="text-muted-foreground mr-1.5">
                          {v.firstRegistration.slice(0, 4)}
                        </span>
                      )}
                      {v.make} {v.model}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      {formatNumber(v.mileage)} km
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {v.vin || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Fahrzeug bearbeiten"
                        onClick={() => navigate(`/vehicles/${v.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Fahrzeug löschen"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(v.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fahrzeug löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Fahrzeug wird unwiderruflich gelöscht. Zugehörige Aufträge bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
