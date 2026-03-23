import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { staffApi, type StaffMember } from '@/api/staff.api';
import { formatCurrency } from '@/lib/utils';
import { StaffDialog } from './StaffDialog';

export function StaffPage() {
  const [page] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', { page }],
    queryFn: () => staffApi.list({ page, pageSize: 20 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mitarbeiter</h1>
        <Button onClick={() => { setEditMember(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Neuer Mitarbeiter
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center text-muted-foreground">Wird geladen...</div>
        ) : data?.data.data.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground">Keine Mitarbeiter gefunden</div>
        ) : (
          data?.data.data.map((member: StaffMember) => (
            <Card key={member.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: member.color || '#5484ed' }}
                    >
                      {member.firstName[0]}
                      {member.lastName[0]}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {member.firstName} {member.lastName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <Badge variant={member.isActive ? 'default' : 'secondary'}>
                    {member.isActive ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.email && (
                  <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                )}
                {member.hourlyRate != null && (
                  <p className="text-sm">{formatCurrency(Number(member.hourlyRate))}/Std.</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { setEditMember(member); setDialogOpen(true); }}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Bearbeiten
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <StaffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialData={editMember ?? undefined}
      />
    </div>
  );
}
