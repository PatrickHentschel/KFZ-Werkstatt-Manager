import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { staffApi, type StaffMember } from '@/api/staff.api';
import { toast } from '@/hooks/use-toast';

const nanToUndefined = (v: unknown) =>
  typeof v === 'number' && isNaN(v) ? undefined : v;

const staffSchema = z.object({
  firstName: z.string().min(1, 'Pflichtfeld'),
  lastName: z.string().min(1, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['technician', 'reception', 'admin']),
  hourlyRate: z.preprocess(nanToUndefined, z.number().nonnegative().optional()),
  color: z.string().optional(),
  isActive: z.boolean(),
});

type StaffForm = z.infer<typeof staffSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: StaffMember;
}

export function StaffDialog({ open, onClose, initialData }: Props) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'technician',
      color: '#3b82f6',
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      reset(initialData
        ? {
            firstName: initialData.firstName,
            lastName: initialData.lastName,
            email: initialData.email ?? '',
            phone: initialData.phone ?? '',
            role: (initialData.role as any) ?? 'technician',
            hourlyRate: initialData.hourlyRate ?? undefined,
            color: initialData.color ?? '#3b82f6',
            isActive: initialData.isActive,
          }
        : { firstName: '', lastName: '', email: '', phone: '', role: 'technician', color: '#3b82f6', isActive: true }
      );
    }
  }, [open, initialData, reset]);

  const mutation = useMutation({
    mutationFn: (data: StaffForm) => {
      const payload = { ...data, email: data.email || undefined };
      return initialData
        ? staffApi.update(initialData.id, payload)
        : staffApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: initialData ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter erstellt' });
      onClose();
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Fehler', description: err.response?.data?.message || 'Speichern fehlgeschlagen' });
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg flex flex-col">
          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <Dialog.Title className="text-lg font-semibold">
              {initialData ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vorname *</Label>
                <Input {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Nachname *</Label>
                <Input {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>E-Mail</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Telefon</Label>
              <Input {...register('phone')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Rolle *</Label>
                <select
                  {...register('role')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="technician">Techniker</option>
                  <option value="reception">Empfang</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Stundensatz (€/h)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('hourlyRate', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Farbe</Label>
                <Input type="color" {...register('color')} className="h-10 cursor-pointer" />
              </div>
              <div className="space-y-1 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('isActive')} className="h-4 w-4" />
                  <span className="text-sm">Aktiv</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-6 border-t shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="button" onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
              {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
