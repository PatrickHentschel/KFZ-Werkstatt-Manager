import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoicesApi } from '@/api/invoices.api';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  invoiceId: string | null;
  /** Beschriftung des Bestätigen-Buttons, z.B. "Versenden" oder "Per E-Mail senden" */
  confirmLabel: string;
  /** Hinweis-Text unter dem Preview, z.B. zur Nummernvergabe */
  notice?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  pending?: boolean;
}

export function PreviewDialog({ open, invoiceId, confirmLabel, notice, onConfirm, onClose, pending }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    invoicesApi.getPdf(invoiceId)
      .then((res) => {
        if (cancelled) return;
        const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
        createdUrl = URL.createObjectURL(blob);
        setPdfUrl(createdUrl);
      })
      .catch(() => {
        if (cancelled) return;
        toast({ variant: 'destructive', title: 'Vorschau konnte nicht geladen werden' });
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setPdfUrl(null);
    };
  }, [open, invoiceId]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg flex flex-col">
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <Dialog.Title className="text-lg font-semibold">Vorschau vor Versand</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-hidden bg-muted">
            {loading && (
              <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> PDF wird geladen…
              </div>
            )}
            {!loading && pdfUrl && (
              <iframe
                src={pdfUrl}
                title="Rechnungsvorschau"
                className="w-full h-full border-0"
              />
            )}
          </div>

          {notice && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-amber-50 text-amber-900">
              {notice}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 p-4 border-t shrink-0">
            <Button variant="outline" onClick={onClose} disabled={pending}>Abbrechen</Button>
            <Button onClick={() => onConfirm()} disabled={pending || loading}>
              {pending ? 'Wird verarbeitet…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
