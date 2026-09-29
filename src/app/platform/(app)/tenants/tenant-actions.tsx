'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { OwnerLink } from './owner-link';
import { ConfirmDialog } from '@/app/(console)/_shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { platformApiSend } from '@/lib/api/platform-client';
import type {
  ChargerDisconnects,
  OwnerSetupLink,
  PlatformTenantListItem,
  UpdatedTenant,
} from '@/lib/api/platform-types';

export function TenantActions({ tenant }: { tenant: PlatformTenantListItem }) {
  const queryClient = useQueryClient();
  const [disconnects, setDisconnects] = useState<ChargerDisconnects | null>(null);

  const setActive = useMutation({
    mutationFn: (isActive: boolean) =>
      platformApiSend<UpdatedTenant>('PATCH', `/tenants/${tenant.id}`, { isActive }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      if (result.chargers) setDisconnects(result.chargers);
      else {
        toast.success(
          result.tenant.isActive
            ? `${result.tenant.name} is active again.`
            : `${result.tenant.name} is suspended.`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tenant.isActive ? (
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel="Suspend"
          title={`Suspend ${tenant.name}?`}
          description="Every one of its staff, drivers and fleet managers is refused from now on, and its chargers are disconnected. Nothing is deleted; reinstating it brings everything back."
          confirmLabel="Suspend"
          pending={setActive.isPending}
          onConfirm={() => setActive.mutateAsync(false)}
        />
      ) : (
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel="Reinstate"
          title={`Reinstate ${tenant.name}?`}
          description="Its staff, drivers and fleet managers can sign in again, and its chargers are accepted when they next reconnect."
          confirmLabel="Reinstate"
          pending={setActive.isPending}
          onConfirm={() => setActive.mutateAsync(true)}
        />
      )}

      <ResendOwnerLink tenant={tenant} />

      <Dialog
        open={disconnects !== null}
        onOpenChange={(open) => !open && setDisconnects(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tenant.name} is suspended</DialogTitle>
            <DialogDescription>
              What happened to its chargers&apos; live connections.
            </DialogDescription>
          </DialogHeader>
          {disconnects ? <DisconnectCounts counts={disconnects} /> : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisconnectCounts({ counts }: { counts: ChargerDisconnects }) {
  const rows: [string, number][] = [
    ['Chargers registered', counts.stations],
    ['Disconnected now', counts.disconnected],
    ['Not connected at the time', counts.notConnected],
    ['Could not be disconnected', counts.failed],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {counts.failed > 0 ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          Some chargers could not be told to disconnect. They are still refused
          when they next connect, since the tenant is suspended.
        </p>
      ) : null}
    </div>
  );
}

/**
 * A new setup link for the tenant's owner — for one who lost the first, or
 * let it expire. One click: the API finds the owner itself (the first active
 * one, the one the list shows), so nothing is typed. The old link stops
 * working, which is why the dialog says so.
 */
function ResendOwnerLink({ tenant }: { tenant: PlatformTenantListItem }) {
  const [issued, setIssued] = useState<OwnerSetupLink | null>(null);
  const queryClient = useQueryClient();
  const email = tenant.owner?.email ?? '';

  const issue = useMutation({
    mutationFn: () =>
      platformApiSend<OwnerSetupLink>('POST', `/tenants/${tenant.id}/owner-setup-token`),
    onSuccess: (link) => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      setIssued(link);
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError && error.status === 404
          ? `${tenant.name} has no active owner to send a link to.`
          : error.message,
      ),
  });

  const hasOwner = tenant.owner !== null && tenant.activeOwners > 0;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => issue.mutate()}
        disabled={!hasOwner || issue.isPending}
        title={hasOwner ? `Email ${email} a link to choose a new password` : 'This tenant has no active owner'}
      >
        {issue.isPending ? 'Issuing…' : 'Reset owner password'}
      </Button>
      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New link for {email}</DialogTitle>
            <DialogDescription>
              Any earlier link for this owner stops working.
            </DialogDescription>
          </DialogHeader>
          {issued ? <OwnerLink email={email} link={issued} kind="reset" /> : null}
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
