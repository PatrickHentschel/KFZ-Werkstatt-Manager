import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appointmentsApi, type CalendarEvent } from '@/api/appointments.api';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  location: z.string().optional(),
  colorId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultSlot?: { start: string; end: string } | null;
  onDelete?: (id: string) => void;
}

const COLOR_OPTIONS = [
  { id: '9', name: 'Blau', color: '#5484ed' },
  { id: '10', name: 'Grün', color: '#51b749' },
  { id: '11', name: 'Rot', color: '#dc2127' },
  { id: '5', name: 'Gelb', color: '#fbd75b' },
  { id: '6', name: 'Orange', color: '#ffb878' },
  { id: '3', name: 'Lila', color: '#dbadff' },
  { id: '7', name: 'Türkis', color: '#46d6db' },
];

function formatForInput(isoString: string): string {
  try {
    return format(parseISO(isoString), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

export function EventDialog({ open, onClose, event, defaultSlot, onDelete }: Props) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedColor = watch('colorId');

  useEffect(() => {
    if (event) {
      reset({
        title: event.summary || '',
        description: event.description || '',
        startTime: event.start.dateTime ? formatForInput(event.start.dateTime) : '',
        endTime: event.end.dateTime ? formatForInput(event.end.dateTime) : '',
        location: event.location || '',
        colorId: event.colorId || '9',
      });
    } else if (defaultSlot) {
      reset({
        title: '',
        description: '',
        startTime: formatForInput(defaultSlot.start),
        endTime: formatForInput(defaultSlot.end),
        location: '',
        colorId: '9',
      });
    } else {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const later = new Date(now);
      later.setHours(later.getHours() + 1);
      reset({
        title: '',
        description: '',
        startTime: format(now, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(later, "yyyy-MM-dd'T'HH:mm"),
        location: '',
        colorId: '9',
      });
    }
  }, [event, defaultSlot, open]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        location: data.location,
        colorId: data.colorId,
      };
      return event
        ? appointmentsApi.updateEvent(event.id, payload)
        : appointmentsApi.createEvent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', 'events'] });
      toast({ title: event ? 'Termin aktualisiert' : 'Termin erstellt' });
      onClose();
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Google Calendar Fehler',
      });
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {event ? 'Termin bearbeiten' : 'Neuer Termin'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input placeholder="Ölwechsel, Inspektion..." {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" {...register('startTime')} />
              </div>
              <div className="space-y-2">
                <Label>Ende</Label>
                <Input type="datetime-local" {...register('endTime')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ort (optional)</Label>
              <Input placeholder="Werkstatt, Halle 2..." {...register('location')} />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input placeholder="Notizen zum Termin..." {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === c.id ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                    onClick={() => setValue('colorId', c.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDelete(event.id);
                    onClose();
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Löschen
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
