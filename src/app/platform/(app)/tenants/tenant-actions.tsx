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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { platformApiSend } from '@/lib/api/platform-client';
import type {
  ChargerDisconnects,
  OwnerSetupLink,
  PlatformTenant,
  UpdatedTenant,
} from '@/lib/api/platform-types';

export function TenantActions({ tenant }: { tenant: PlatformTenant }) {
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
 * A new setup link for one of the tenant's owners — for an owner who lost
 * the first one, or let it expire. The platform does not list a tenant's
 * people, so the admin says which owner it is for; the API answers 404 when
 * that address is not an owner of this tenant.
 */
function ResendOwnerLink({ tenant }: { tenant: PlatformTenant }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [issued, setIssued] = useState<{ email: string; link: OwnerSetupLink } | null>(
    null,
  );

  const issue = useMutation({
    mutationFn: () =>
      platformApiSend<OwnerSetupLink>('POST', `/tenants/${tenant.id}/owner-setup-token`, {
        email: email.trim(),
      }),
    onSuccess: (link) => {
      setIssued({ email: email.trim(), link });
      setEmail('');
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError && error.status === 404
          ? `${email.trim()} is not an owner of ${tenant.name}.`
          : error.message,
      ),
  });

  function close() {
    setOpen(false);
    setIssued(null);
    setEmail('');
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Resend owner link
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          {issued ? (
            <>
              <DialogHeader>
                <DialogTitle>New link for {issued.email}</DialogTitle>
                <DialogDescription>
                  Any earlier link for this owner stops working.
                </DialogDescription>
              </DialogHeader>
              <OwnerLink email={issued.email} link={issued.link} kind="reset" />
              <DialogFooter>
                <Button onClick={close}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Resend an owner link for {tenant.name}</DialogTitle>
                <DialogDescription>
                  Which owner is it for? They get a new link to choose their
                  password from.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`owner-email-${tenant.id}`}>Owner email</Label>
                <Input
                  id={`owner-email-${tenant.id}`}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => issue.mutate()}
                  disabled={email.trim().length === 0 || issue.isPending}
                >
                  {issue.isPending ? 'Issuing…' : 'Issue new link'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
