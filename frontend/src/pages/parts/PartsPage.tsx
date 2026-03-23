import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, Trash2, TrendingUp, TrendingDown, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as Dialog from '@radix-ui/react-dialog';
import { partsApi, type Part, type Vendor } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { PartDialog } from './PartDialog';

function VendorDialog({
  open,
  onClose,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Vendor;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', contactPerson: '', notes: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData?.name ?? '',
        email: initialData?.email ?? '',
        phone: initialData?.phone ?? '',
        address: initialData?.address ?? '',
        contactPerson: initialData?.contactPerson ?? '',
        notes: initialData?.notes ?? '',
      });
    }
  }, [open, initialData]);

  const mutation = useMutation({
    mutationFn: () =>
      isEditing
        ? partsApi.updateVendor(initialData!.id, form)
        : partsApi.createVendor(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: isEditing ? 'Lieferant aktualisiert' : 'Lieferant erstellt' });
      onClose();
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-lg font-semibold">
              {isEditing ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Lieferant GmbH"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="info@lieferant.at"
                />
              </div>
              <div className="space-y-1">
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+43 1 234 5678"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Ansprechpartner</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-1">
              <Label>Adresse</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Musterstraße 1, Wien"
              />
            </div>
            <div className="space-y-1">
              <Label>Notizen</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optionale Notizen"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !form.name.trim()}
              >
                {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PartsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'parts' | 'vendors'>('parts');

  // Parts state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showLowStock, setShowLowStock] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPart, setEditPart] = useState<Part | undefined>(undefined);

  // Vendors state
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['parts', { page, search, lowStock: showLowStock }],
    queryFn: () =>
      partsApi.list({ page, pageSize: 20, search: search || undefined, lowStock: showLowStock || undefined }),
    enabled: tab === 'parts',
  });

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => partsApi.listVendors(),
    enabled: tab === 'vendors',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => partsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast({ title: 'Teil gelöscht' });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, adj }: { id: string; adj: number }) => partsApi.adjustStock(id, adj),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parts'] }),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => partsApi.deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: 'Lieferant gelöscht' });
    },
  });

  const vendors: Vendor[] = vendorsData?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Teile & Lager</h1>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'parts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('parts')}
        >
          Teile
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'vendors' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('vendors')}
        >
          Lieferanten
        </button>
      </div>

      {/* Parts tab */}
      {tab === 'parts' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Teile suchen (SKU, Name, OEM)..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Button
              variant={showLowStock ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowLowStock((s) => !s)}
              className="flex items-center gap-1"
            >
              <AlertTriangle className="h-4 w-4" />
              Mindestbestand
            </Button>
            <Button onClick={() => { setEditPart(undefined); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Neues Teil
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Wird geladen...</div>
              ) : data?.data.data.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Keine Teile gefunden</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">SKU</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Kategorie</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Bestand</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">VK-Preis</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data?.data.data.map((part: Part) => {
                      const isLowStock = Number(part.stockQuantity) <= Number(part.minStock);
                      return (
                        <tr key={part.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-sm">{part.sku}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{part.name}</div>
                            {part.oemNumber && (
                              <div className="text-xs text-muted-foreground">OEM: {part.oemNumber}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {part.category && <Badge variant="outline">{part.category}</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className={`flex items-center justify-end gap-2 ${isLowStock ? 'text-orange-600' : ''}`}>
                              {isLowStock && <AlertTriangle className="h-4 w-4" />}
                              <span className="font-medium">{part.stockQuantity} {part.unit}</span>
                            </div>
                            <div className="text-xs text-muted-foreground text-right">Min: {part.minStock}</div>
                            <div className="flex justify-end gap-1 mt-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="-1"
                                onClick={() => adjustStockMutation.mutate({ id: part.id, adj: -1 })}>
                                <TrendingDown className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="+1"
                                onClick={() => adjustStockMutation.mutate({ id: part.id, adj: 1 })}>
                                <TrendingUp className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(Number(part.salePrice))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="icon"
                              onClick={() => { setEditPart(part); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => { if (confirm('Teil wirklich löschen?')) deleteMutation.mutate(part.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {data && data.data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Zurück</Button>
              <span className="flex items-center text-sm">Seite {page} von {data.data.totalPages}</span>
              <Button variant="outline" disabled={page === data.data.totalPages} onClick={() => setPage((p) => p + 1)}>Weiter</Button>
            </div>
          )}
        </>
      )}

      {/* Vendors tab */}
      {tab === 'vendors' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => { setEditVendor(undefined); setVendorDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Neuer Lieferant
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {vendorsLoading ? (
                <div className="p-6 text-center text-muted-foreground">Wird geladen...</div>
              ) : vendors.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Noch keine Lieferanten angelegt</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Ansprechpartner</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">E-Mail</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Telefon</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{vendor.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{vendor.contactPerson || '—'}</td>
                        <td className="px-4 py-3 text-sm">{vendor.email || '—'}</td>
                        <td className="px-4 py-3 text-sm">{vendor.phone || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon"
                            onClick={() => { setEditVendor(vendor); setVendorDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Lieferant wirklich löschen?')) deleteVendorMutation.mutate(vendor.id); }}>
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
        </>
      )}

      <PartDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditPart(undefined); }}
        initialData={editPart}
      />

      <VendorDialog
        open={vendorDialogOpen}
        onClose={() => { setVendorDialogOpen(false); setEditVendor(undefined); }}
        initialData={editVendor}
      />
    </div>
  );
}
