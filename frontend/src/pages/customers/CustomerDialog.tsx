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

const PLZ_RE = /^[0-9]{5}$/;
const PHONE_RE = /^(\+49|0)[0-9 \-/()]{6,20}$/;
const HOUSE_NR_RE = /^[0-9]{1,5}[a-zA-Z]?(\s?[-/]\s?[0-9]{1,5}[a-zA-Z]?)?$/;

const schema = z.object({
  type: z.enum(['private', 'business']).default('private'),
  salutation: z.enum(['herr', 'frau', 'divers']).optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  birthDate: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().refine(v => !v || PHONE_RE.test(v), 'Format: +49... oder 0...').optional(),
  street: z.string().optional(),
  houseNumber: z.string().refine(v => !v || HOUSE_NR_RE.test(v), 'Ungültige Hausnummer').optional(),
  city: z.string().optional(),
  postalCode: z.string().refine(v => !v || PLZ_RE.test(v), 'PLZ muss 5 Ziffern enthalten').optional(),
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
    defaultValues: { type: 'private' },
  });

  const customerType = watch('type');

  useEffect(() => {
    if (customer) {
      reset({
        type: customer.type,
        salutation: customer.salutation || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        companyName: customer.companyName || '',
        birthDate: customer.birthDate || '',
        email: customer.email || '',
        phone: customer.phone || '',
        street: customer.street || '',
        houseNumber: customer.houseNumber || '',
        city: customer.city || '',
        postalCode: customer.postalCode || '',
      });
    } else {
      reset({ type: 'private' });
    }
  }, [customer, open]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      // Empty-Strings → null/undefined für nullable Felder
      const payload = {
        ...data,
        salutation: data.salutation || null,
        birthDate: data.birthDate || null,
      };
      return customer ? customersApi.update(customer.id, payload as any) : customersApi.create(payload as any);
    },
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
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
              <>
                <div className="grid grid-cols-[140px_1fr_1fr] gap-2">
                  <div className="space-y-2">
                    <Label>Anrede</Label>
                    <select
                      {...register('salutation')}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— bitte wählen —</option>
                      <option value="herr">Herr</option>
                      <option value="frau">Frau</option>
                      <option value="divers">Divers</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vorname</Label>
                    <Input placeholder="Max" {...register('firstName')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nachname</Label>
                    <Input placeholder="Mustermann" {...register('lastName')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Geburtsdatum</Label>
                  <Input type="date" {...register('birthDate')} className="w-48" />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input type="email" placeholder="max@example.de" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input placeholder="+49 30 1234567" {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div className="space-y-2">
                <Label>Straße</Label>
                <Input placeholder="Musterstraße" {...register('street')} />
              </div>
              <div className="space-y-2">
                <Label>Hausnummer</Label>
                <Input placeholder="12a" {...register('houseNumber')} />
                {errors.houseNumber && <p className="text-xs text-destructive">{errors.houseNumber.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>PLZ</Label>
                <Input placeholder="10115" maxLength={5} {...register('postalCode')} />
                {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode.message}</p>}
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Stadt</Label>
                <Input placeholder="Berlin" {...register('city')} />
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
