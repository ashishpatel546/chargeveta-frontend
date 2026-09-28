'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../_shared/confirm-dialog';
import { MembersTable } from '@/components/fleet/members-table';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiGet, apiSend } from '@/lib/api/client';
import type { FleetMember } from '@/lib/api/fleet-types';

/** A driver as staff's `GET /drivers` lists them. */
interface StaffDriver {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  isActive: boolean;
}

export function MembersTab({ fleetId }: { fleetId: string }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ['fleet', fleetId, 'members'],
    queryFn: () => apiGet<FleetMember[]>(`/fleets/${fleetId}/members`),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fleet', fleetId] }),
      queryClient.invalidateQueries({ queryKey: ['fleets'] }),
    ]);

  const remove = useMutation({
    mutationFn: (driverId: string) =>
      apiSend<void>('DELETE', `/fleets/${fleetId}/members/${driverId}`),
    onSuccess: () => {
      toast.success('Driver removed from the fleet.');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          The fleet sees a driver&apos;s sessions from the moment they are
          added, never before. A driver is in one fleet at most.
        </p>
        {canAdmin ? (
          <AddDriverDialog
            fleetId={fleetId}
            memberIds={new Set(members.data?.map((m) => m.driverId) ?? [])}
            onAdded={refresh}
          />
        ) : null}
      </div>
      {members.isPending ? <Loading /> : null}
      {members.isError ? <Failed error={members.error} /> : null}
      {members.isSuccess && members.data.length === 0 ? (
        <Empty>No drivers in this fleet yet.</Empty>
      ) : null}
      {members.isSuccess && members.data.length > 0 ? (
        <MembersTable
          members={members.data}
          actions={
            canAdmin
              ? (member) => (
                  <ConfirmDialog
                    trigger={<Button variant="outline" size="sm" />}
                    triggerLabel="Remove"
                    title={`Remove ${member.name ?? member.email ?? 'this driver'}?`}
                    description="The fleet stops seeing their new sessions, and they stop being any vehicle's driver. Sessions already billed to the fleet stay billed to it."
                    confirmLabel="Remove"
                    pending={remove.isPending}
                    onConfirm={() => remove.mutateAsync(member.driverId)}
                  />
                )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function AddDriverDialog({
  fleetId,
  memberIds,
  onAdded,
}: {
  fleetId: string;
  memberIds: Set<string>;
  onAdded: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const search = q.trim();

  const drivers = useQuery({
    queryKey: ['drivers', 'search', search],
    queryFn: () =>
      apiGet<{ items: StaffDriver[] }>('/drivers', { q: search, limit: '10' }),
    enabled: open && search.length >= 2,
  });

  const add = useMutation({
    mutationFn: (driverId: string) =>
      apiSend<FleetMember[]>('PUT', `/fleets/${fleetId}/members/${driverId}`),
    onSuccess: () => {
      toast.success('Driver added to the fleet.');
      void onAdded();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add driver</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a driver</DialogTitle>
          <DialogDescription>
            Search by name, email or phone. The driver must already have an
            account on your network.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="At least two characters"
          autoFocus
        />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {drivers.isFetching ? (
            <p className="text-muted-foreground text-sm">Searching…</p>
          ) : null}
          {drivers.isError ? <Failed error={drivers.error} /> : null}
          {drivers.isSuccess && drivers.data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No driver matches.</p>
          ) : null}
          {drivers.data?.items.map((driver) => {
            const already = memberIds.has(driver.id);
            return (
              <div
                key={driver.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{driver.name ?? '—'}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[driver.email, driver.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={already ? 'outline' : 'default'}
                  disabled={already || add.isPending}
                  onClick={() => add.mutate(driver.id)}
                >
                  {already ? 'In fleet' : 'Add'}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
