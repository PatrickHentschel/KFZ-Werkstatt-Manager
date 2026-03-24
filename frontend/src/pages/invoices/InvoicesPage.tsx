import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, FileDown, Pencil, Search, Send, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { invoicesApi, type Invoice, type InvoiceStatus } from '@/api/invoices.api';
import { paymentsApi } from '@/api/payments.api';
import { toast } from '@/hooks/use-toast';
import { InvoiceDialog } from './InvoiceDialog';

const statusLabel: Record<string, string> = { draft: 'Entwurf', sent: 'Versendet', paid: 'Bezahlt', cancelled: 'Storniert' };
const statusVariant: Record<string, string> = { draft: 'secondary', sent: 'default', paid: 'success', cancelled: 'destructive' };

const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
  try {
    const response = await invoicesApi.getPdf(id);
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast({ variant: 'destructive', title: 'PDF nicht verfuegbar' });
  }
};

const tabs: { label: string; value: 'all' | InvoiceStatus }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Entwurf', value: 'draft' },
  { label: 'Versendet', value: 'sent' },
  { label: 'Bezahlt', value: 'paid' },
  { label: 'Storniert', value: 'cancelled' },
];

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | InvoiceStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);

  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => paymentsApi.getConfig().then((r) => r.data),
    staleTime: Infinity,
  });

  const handlePayment = async (invoiceId: string) => {
    setCheckingOutId(invoiceId);
    try {
      const { data: session } = await paymentsApi.createCheckout(invoiceId);
      if (session.mode === 'demo') {
        navigate(`/demo-checkout?session=${session.sessionId}&invoice=${invoiceId}`);
      } else {
        window.location.href = session.url;
      }
    } catch {
      toast({ variant: 'destructive', title: 'Checkout konnte nicht gestartet werden' });
      setCheckingOutId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, search, activeTab }],
    queryFn: () =>
      invoicesApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
      }),
  });

  const markSent = useMutation({
    mutationFn: (id: string) => invoicesApi.updateStatus(id, 'sent'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Als versendet markiert' });
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => invoicesApi.updateStatus(id, 'paid'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Als bezahlt markiert' });
    },
  });

  const sendInvoice = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Rechnung per E-Mail versendet' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'E-Mail konnte nicht gesendet werden';
      toast({ variant: 'destructive', title: msg });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Rechnungen</h1>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechnungen suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Neue Rechnung
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
                  <th className="px-4 py-3 text-left text-sm font-medium">Rechnungsnr.</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Kunde</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.data.data.map((inv: Invoice) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm">
                      {inv.customer
                        ? `${inv.customer.firstName || ''} ${inv.customer.lastName || ''}${inv.customer.companyName || ''}`.trim()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(inv.issueDate).toLocaleDateString('de-AT')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[inv.status] as any}>{statusLabel[inv.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Bearbeiten"
                            onClick={() => setEditInvoice(inv)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markSent.mutate(inv.id)}
                          >
                            Versenden
                          </Button>
                        )}
                        {(inv.status === 'draft' || inv.status === 'sent') && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Per E-Mail senden"
                            onClick={() => sendInvoice.mutate(inv.id)}
                            disabled={sendInvoice.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.status === 'sent' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePayment(inv.id)}
                            disabled={checkingOutId === inv.id}
                          >
                            <CreditCard className="mr-1 h-4 w-4" />
                            {paymentConfig?.mode === 'stripe' ? 'Online bezahlen' : 'Bezahlen'}
                          </Button>
                        )}
                        {inv.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markPaid.mutate(inv.id)}
                          >
                            Als bezahlt markieren
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="PDF herunterladen"
                          onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                        >
                          <FileDown className="h-4 w-4" />
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

      <InvoiceDialog
        open={dialogOpen || !!editInvoice}
        onClose={() => { setDialogOpen(false); setEditInvoice(null); }}
        invoice={editInvoice ?? undefined}
      />
    </div>
  );
}
