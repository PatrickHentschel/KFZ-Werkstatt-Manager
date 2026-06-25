import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Fahrzeuge</h1>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
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
            <div className="p-6 text-center text-muted-foreground">Wird geladen...</div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kunde</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kennzeichen</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">KM-Stand</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">FIN</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Modell</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data.data.map((v: Vehicle) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{customerName(v.customer)}</td>
                    <td className="px-4 py-3 font-mono font-medium">{v.licensePlate}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      {formatNumber(v.mileage)} km
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {v.vin || '—'}
                    </td>
                    <td className="px-4 py-3">{v.make} {v.model}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/vehicles/${v.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Fahrzeug wirklich löschen?')) deleteMutation.mutate(v.id);
                        }}
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
    </div>
  );
}
