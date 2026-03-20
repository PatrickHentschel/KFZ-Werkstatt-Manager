import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { partsApi, type Part, type Vendor } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';

const nanToUndefined = (v: unknown) =>
  typeof v === 'number' && isNaN(v) ? undefined : v;

const schema = z.object({
  sku: z.string().min(1, 'Pflichtfeld'),
  oemNumber: z.string().optional(),
  name: z.string().min(1, 'Pflichtfeld'),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().default('Stk'),
  location: z.string().optional(),
  purchasePrice: z.preprocess(nanToUndefined, z.number().nonnegative('Muss ≥ 0 sein')),
  salePrice: z.preprocess(nanToUndefined, z.number().nonnegative('Muss ≥ 0 sein')),
  taxRate: z.preprocess(nanToUndefined, z.number().nonnegative().default(20)),
  minStock: z.preprocess(nanToUndefined, z.number().int().nonnegative().default(0)),
  stockQuantity: z.preprocess(nanToUndefined, z.number().int().nonnegative().default(0)),
  vendorId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Part;
}

export function PartDialog({ open, onClose, initialData }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: '',
      oemNumber: '',
      name: '',
      description: '',
      category: '',
      unit: 'Stk',
      location: '',
      purchasePrice: undefined,
      salePrice: undefined,
      taxRate: 20,
      minStock: 0,
      stockQuantity: 0,
      vendorId: '',
    },
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => partsApi.listVendors(),
    enabled: open,
  });

  const vendors: Vendor[] = vendorsData?.data?.data ?? [];

  useEffect(() => {
    if (open) {
      reset(
        initialData
          ? {
              sku: initialData.sku,
              oemNumber: initialData.oemNumber ?? '',
              name: initialData.name,
              description: initialData.description ?? '',
              category: initialData.category ?? '',
              unit: initialData.unit,
              location: initialData.location ?? '',
              purchasePrice: Number(initialData.purchasePrice),
              salePrice: Number(initialData.salePrice),
              taxRate: Number(initialData.taxRate),
              minStock: Number(initialData.minStock),
              stockQuantity: Number(initialData.stockQuantity),
              vendorId: initialData.vendorId ?? '',
            }
          : {
              sku: '',
              oemNumber: '',
              name: '',
              description: '',
              category: '',
              unit: 'Stk',
              location: '',
              purchasePrice: undefined,
              salePrice: undefined,
              taxRate: 20,
              minStock: 0,
              stockQuantity: 0,
              vendorId: '',
            }
      );
    }
  }, [open, initialData, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        oemNumber: data.oemNumber || undefined,
        description: data.description || undefined,
        category: data.category || undefined,
        location: data.location || undefined,
        vendorId: data.vendorId || undefined,
      };
      return isEditing
        ? partsApi.update(initialData.id, payload)
        : partsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast({ title: isEditing ? 'Teil aktualisiert' : 'Teil erstellt' });
      onClose();
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Speichern fehlgeschlagen',
      });
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
            <Dialog.Title className="text-lg font-semibold">
              {isEditing ? 'Teil bearbeiten' : 'Neues Teil'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">

            {/* SKU / OEM-Nummer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>SKU *</Label>
                <Input placeholder="z.B. FILT-001" {...register('sku')} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>OEM-Nummer</Label>
                <Input placeholder="z.B. 1234567890" {...register('oemNumber')} />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input placeholder="z.B. Ölfilter 5W-30" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Beschreibung */}
            <div className="space-y-1">
              <Label>Beschreibung</Label>
              <Input placeholder="Optionale Beschreibung" {...register('description')} />
            </div>

            {/* Kategorie / Einheit / Lagerort */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Kategorie</Label>
                <Input placeholder="z.B. Filter" {...register('category')} />
              </div>
              <div className="space-y-1">
                <Label>Einheit</Label>
                <Input placeholder="Stk" {...register('unit')} />
              </div>
              <div className="space-y-1">
                <Label>Lagerort</Label>
                <Input placeholder="z.B. Regal A3" {...register('location')} />
              </div>
            </div>

            {/* Einkaufspreis / Verkaufspreis / MwSt % */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Einkaufspreis (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('purchasePrice', { valueAsNumber: true })}
                />
                {errors.purchasePrice && (
                  <p className="text-xs text-destructive">{errors.purchasePrice.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Verkaufspreis (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('salePrice', { valueAsNumber: true })}
                />
                {errors.salePrice && (
                  <p className="text-xs text-destructive">{errors.salePrice.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>MwSt (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="20"
                  {...register('taxRate', { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Mindestbestand / Bestand — stockQuantity only on create */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Mindestbestand</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="0"
                  {...register('minStock', { valueAsNumber: true })}
                />
              </div>
              {!isEditing && (
                <div className="space-y-1">
                  <Label>Anfangsbestand</Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="0"
                    {...register('stockQuantity', { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>

            {/* Lieferant */}
            <div className="space-y-1">
              <Label>Lieferant</Label>
              <select
                {...register('vendorId')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">-- Kein Lieferant --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
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
