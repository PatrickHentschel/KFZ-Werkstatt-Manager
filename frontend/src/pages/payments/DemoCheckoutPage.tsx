import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { paymentsApi } from '@/api/payments.api';
import { toast } from '@/hooks/use-toast';

export function DemoCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get('invoice');
  const sessionId = searchParams.get('session');
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!invoiceId || !sessionId) {
      toast({ variant: 'destructive', title: 'Ungültige Zahlungsparameter' });
      return;
    }

    setProcessing(true);
    try {
      // Simulate card processing delay
      await new Promise((r) => setTimeout(r, 2000));
      await paymentsApi.confirmDemo(invoiceId, sessionId);
      navigate(`/payment-success?invoice=${invoiceId}`);
    } catch {
      toast({ variant: 'destructive', title: 'Zahlung fehlgeschlagen' });
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Demo mode banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Demo-Modus — keine echte Transaktion wird durchgeführt</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Sichere Zahlung</CardTitle>
            </div>
            <CardDescription>
              Geben Sie Ihre Kartendaten ein, um die Rechnung zu bezahlen
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-number">Kartennummer</Label>
              <Input
                id="card-number"
                defaultValue="4242 4242 4242 4242"
                readOnly
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-name">Name auf der Karte</Label>
              <Input
                id="card-name"
                defaultValue="Hans Meister"
                readOnly
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expiry">Ablaufdatum</Label>
                <Input id="expiry" defaultValue="12/28" readOnly className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input id="cvc" defaultValue="123" readOnly className="font-mono" />
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handlePay}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zahlung wird verarbeitet...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Jetzt bezahlen
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Demo-Modus: Die Kartendaten sind vorausgefüllt und werden nicht übertragen
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
