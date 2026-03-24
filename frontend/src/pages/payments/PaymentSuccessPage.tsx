import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { paymentsApi } from '@/api/payments.api';
import { invoicesApi } from '@/api/invoices.api';
import { toast } from '@/hooks/use-toast';

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
    toast({ variant: 'destructive', title: 'PDF nicht verfügbar' });
  }
};

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const invoiceId = searchParams.get('invoice');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['payment-success', sessionId ?? invoiceId],
    queryFn: () => sessionId
      ? paymentsApi.verifySuccess(sessionId).then((r) => r.data)
      : Promise.resolve(null),
    enabled: !!sessionId,
    retry: 3,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6 text-center">
          {isLoading ? (
            <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
          ) : (
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          )}

          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Zahlung erfolgreich</h1>
            <p className="text-muted-foreground">
              {invoice
                ? `Rechnung ${invoice.invoiceNumber} wurde als bezahlt markiert.`
                : 'Die Rechnung wurde als bezahlt markiert.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            {invoice && (
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceNumber)}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Rechnung herunterladen
              </Button>
            )}
            <Button onClick={() => navigate('/invoices')}>
              Zu den Rechnungen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
