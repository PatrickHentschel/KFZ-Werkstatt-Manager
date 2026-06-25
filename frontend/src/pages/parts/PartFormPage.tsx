import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { partsApi, type Vendor } from '@/api/parts.api';
import { toast } from '@/hooks/use-toast';
import { ResourceFormLayout, FormSection } from '@/components/shared/ResourceFormLayout';

const nanToUndefined = (v: unknown) => (typeof v === 'number' && isNaN(v) ? undefined : v);

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
  taxRate: z.preprocess(nanToUndefined, z.number().nonnegative().default(19)),
  minStock: z.preprocess(nanToUndefined, z.number().int().nonnegative().default(0)),
  stockQuantity: z.preprocess(nanToUndefined, z.number().int().nonnegative().default(0)),
  vendorId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const emptyDefaults: Partial<FormData> = {
  sku: '',
  oemNumber: '',
  name: '',
  description: '',
  category: '',
  unit: 'Stk',
  location: '',
  purchasePrice: undefined,
  salePrice: undefined,
  taxRate: 19,
  minStock: 0,
  stockQuantity: 0,
  vendorId: '',
};

export function PartFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['part', id],
    queryFn: () => partsApi.getById(id!).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => partsApi.listVendors(),
  });

  const vendors: Vendor[] = vendorsData?.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (!existing) return;
    reset({
      sku: existing.sku,
      oemNumber: existing.oemNumber ?? '',
      name: existing.name,
      description: existing.description ?? '',
      category: existing.category ?? '',
      unit: existing.unit,
      location: existing.location ?? '',
      purchasePrice: Number(existing.purchasePrice),
      salePrice: Number(existing.salePrice),
      taxRate: Number(existing.taxRate),
      minStock: Number(existing.minStock),
      stockQuantity: Number(existing.stockQuantity),
      vendorId: existing.vendorId ?? '',
    });
  }, [existing, reset]);

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
      return isEdit ? partsApi.update(id!, payload) : partsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['part', id] });
      toast({ title: isEdit ? 'Teil aktualisiert' : 'Teil erstellt' });
      navigate('/parts');
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.response?.data?.message || 'Speichern fehlgeschlagen',
      });
    },
  });

  if (isEdit && isLoadingExisting) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
  }

  return (
    <ResourceFormLayout
      title={isEdit ? 'Teil bearbeiten' : 'Neues Teil'}
      subtitle={isEdit && existing ? `${existing.sku} · ${existing.name}` : undefined}
      onCancel={() => navigate('/parts')}
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <FormSection title="Identifikation">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>SKU <span className="text-destructive">*</span></Label>
            <Input placeholder="z.B. FILT-001" className="font-mono" {...register('sku')} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>OEM-Nummer</Label>
            <Input placeholder="z.B. 1234567890" className="font-mono" {...register('oemNumber')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input placeholder="z.B. Ölfilter 5W-30" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Beschreibung</Label>
          <Input placeholder="Optionale Beschreibung" {...register('description')} />
        </div>
      </FormSection>

      <FormSection title="Lager">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Input placeholder="z.B. Filter" {...register('category')} />
          </div>
          <div className="space-y-2">
            <Label>Einheit</Label>
            <Input placeholder="Stk" {...register('unit')} />
          </div>
          <div className="space-y-2">
            <Label>Lagerort</Label>
            <Input placeholder="z.B. Regal A3" {...register('location')} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Mindestbestand</Label>
            <Input
              type="number"
              step="1"
              placeholder="0"
              {...register('minStock', { valueAsNumber: true })}
            />
          </div>
          {!isEdit && (
            <div className="space-y-2">
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
      </FormSection>

      <FormSection title="Preise">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Einkaufspreis (€) <span className="text-destructive">*</span></Label>
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
          <div className="space-y-2">
            <Label>Verkaufspreis (€) <span className="text-destructive">*</span></Label>
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
          <div className="space-y-2">
            <Label>MwSt (%)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="20"
              {...register('taxRate', { valueAsNumber: true })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Lieferant">
        <div className="space-y-2">
          <Label>Lieferant</Label>
          <select
            {...register('vendorId')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— Kein Lieferant —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </FormSection>
    </ResourceFormLayout>
  );
}
