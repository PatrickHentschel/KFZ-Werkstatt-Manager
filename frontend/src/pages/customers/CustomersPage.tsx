import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { customersApi, type Customer } from '@/api/customers.api';
import { toast } from '@/hooks/use-toast';

export function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, search }],
    queryFn: () => customersApi.list({ page, pageSize: 20, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Kunde gelöscht' });
    },
  });

  const getDisplayName = (c: Customer) =>
    c.type === 'business' ? c.companyName : `${c.firstName || ''} ${c.lastName || ''}`.trim();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Kunden</h1>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kunden suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => navigate('/customers/new')}>
          <Plus className="mr-2 h-4 w-4" /> Neuer Kunde
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Wird geladen...</div>
          ) : data?.data.data.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Keine Kunden gefunden</div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Typ</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Telefon</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Stadt</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data.data.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {customer.type === 'business' ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium">{getDisplayName(customer) || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{customer.type === 'business' ? 'Unternehmen' : 'Privat'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{customer.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{customer.phone || customer.mobile || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{customer.city || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Kunden wirklich löschen?')) deleteMutation.mutate(customer.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Zurück</Button>
          <span className="flex items-center text-sm">Seite {page} von {data.data.totalPages}</span>
          <Button variant="outline" disabled={page === data.data.totalPages} onClick={() => setPage(p => p + 1)}>Weiter</Button>
        </div>
      )}
    </div>
  );
}
