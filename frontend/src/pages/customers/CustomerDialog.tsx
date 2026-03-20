import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customersApi, type Customer } from '@/api/customers.api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const schema = z.object({
  type: z.enum(['private', 'business']).default('private'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('AT'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

export function CustomerDialog({ open, onClose, customer }: Props) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'private', country: 'AT' },
  });

  const customerType = watch('type');

  useEffect(() => {
    if (customer) {
      reset({
        type: customer.type,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        companyName: customer.companyName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        postalCode: customer.postalCode || '',
        country: customer.country || 'AT',
      });
    } else {
      reset({ type: 'private', country: 'AT' });
    }
  }, [customer, open]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      customer ? customersApi.update(customer.id, data) : customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: customer ? 'Kunde aktualisiert' : 'Kunde erstellt' });
      onClose();
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Fehler', description: err.response?.data?.message });
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {customer ? 'Kunde bearbeiten' : 'Neuer Kunde'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2">
              {(['private', 'business'] as const).map((t) => (
                <label key={t} className={cn(
                  'flex-1 cursor-pointer rounded-md border p-2 text-center text-sm transition-colors',
                  watch('type') === t ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                )}>
                  <input type="radio" value={t} {...register('type')} className="sr-only" />
                  {t === 'private' ? 'Privatperson' : 'Unternehmen'}
                </label>
              ))}
            </div>

            {customerType === 'business' ? (
              <div className="space-y-2">
                <Label>Firmenname</Label>
                <Input placeholder="Mustermann GmbH" {...register('companyName')} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Vorname</Label>
                  <Input placeholder="Max" {...register('firstName')} />
                </div>
                <div className="space-y-2">
                  <Label>Nachname</Label>
                  <Input placeholder="Mustermann" {...register('lastName')} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input type="email" placeholder="max@example.at" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input placeholder="+43 1 234 5678" {...register('phone')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input placeholder="Musterstraße 1" {...register('address')} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>PLZ</Label>
                <Input placeholder="1010" {...register('postalCode')} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Stadt</Label>
                <Input placeholder="Wien" {...register('city')} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
