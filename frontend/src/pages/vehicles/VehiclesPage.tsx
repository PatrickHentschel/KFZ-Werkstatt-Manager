import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { vehiclesApi, type Vehicle } from '@/api/vehicles.api';
import { toast } from '@/hooks/use-toast';
import { VehicleDialog } from './VehicleDialog';

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | undefined>(undefined);

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

  function openCreate() {
    setEditVehicle(undefined);
    setDialogOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditVehicle(vehicle);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditVehicle(undefined);
  }

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
        <Button onClick={openCreate}>
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
                  <th className="px-4 py-3 text-left text-sm font-medium">Kennzeichen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Marke / Modell</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Baujahr</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kunde</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Nächste HU</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data.data.map((v: Vehicle) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{v.licensePlate}</td>
                    <td className="px-4 py-3">{v.make} {v.model}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{v.year || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {v.customer
                        ? v.customer.companyName
                          || `${v.customer.firstName || ''} ${v.customer.lastName || ''}`.trim()
                          || '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {v.nextTuvDate || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(v)}
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

      <VehicleDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        initialData={editVehicle}
      />
    </div>
  );
}
