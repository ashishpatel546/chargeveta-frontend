'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SetupLink } from '../../_shared/setup-link';
import { ActiveBadge } from '@/components/fleet/billing-badge';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiSend } from '@/lib/api/client';
import type {
  CreatedFleetManager,
  FleetManager,
  FleetManagerSetupToken,
} from '@/lib/api/fleet-types';
import { dateTime } from '@/lib/format';

/** Where a fleet manager's setup link opens: the fleet portal, not the console. */
const FLEET_SETUP_PATH = '/fleet/setup';

/**
 * The fleet's own logins (doc 6 §23). Staff create them; each chooses their
 * password from a one-time link and then signs in at `/fleet`, seeing only
 * this fleet.
 */
export function ManagersTab({ fleetId }: { fleetId: string }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  const managers = useQuery({
    queryKey: ['fleet', fleetId, 'managers'],
    queryFn: () => apiGet<FleetManager[]>(`/fleets/${fleetId}/managers`),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['fleet', fleetId, 'managers'] });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiSend<FleetManager>('PATCH', `/fleets/${fleetId}/managers/${id}`, {
        isActive,
      }),
    onSuccess: (manager) => {
      toast.success(
        manager.isActive
          ? `${manager.email} can sign in again.`
          : `${manager.email} is signed out and cannot sign in.`,
      );
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          People at the fleet company who sign in at{' '}
          <span className="font-mono">/fleet</span> to see its drivers,
          sessions and bill, and to keep its vehicle list.
        </p>
        {canAdmin ? <CreateManagerDialog fleetId={fleetId} onCreated={refresh} /> : null}
      </div>
      {managers.isPending ? <Loading /> : null}
      {managers.isError ? <Failed error={managers.error} /> : null}
      {managers.isSuccess && managers.data.length === 0 ? (
        <Empty>No managers yet.</Empty>
      ) : null}
      {managers.isSuccess && managers.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Last signed in</TableHead>
                <TableHead>Status</TableHead>
                {canAdmin ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.data.map((manager) => (
                <TableRow key={manager.id}>
                  <TableCell className="font-medium">{manager.email}</TableCell>
                  <TableCell className="text-sm">{manager.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {manager.lastSignInAt ? dateTime(manager.lastSignInAt) : 'never'}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={manager.isActive} />
                  </TableCell>
                  {canAdmin ? (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {manager.isActive ? (
                          <SetupLinkDialog fleetId={fleetId} manager={manager} />
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setActive.isPending}
                          onClick={() =>
                            setActive.mutate({
                              id: manager.id,
                              isActive: !manager.isActive,
                            })
                          }
                        >
                          {manager.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function CreateManagerDialog({
  fleetId,
  onCreated,
}: {
  fleetId: string;
  onCreated: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedFleetManager | null>(null);

  const create = useMutation({
    mutationFn: () =>
      apiSend<CreatedFleetManager>('POST', `/fleets/${fleetId}/managers`, {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (result) => {
      setCreated(result);
      setEmail('');
      setName('');
      void onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function close() {
    setOpen(false);
    // The token is never kept: once this closes it is gone.
    setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button />}>Add manager</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.manager.email} has been added</DialogTitle>
              <DialogDescription>
                They choose their own password from the link, then sign in at
                the fleet portal.
              </DialogDescription>
            </DialogHeader>
            <SetupLink
              kind="invitation"
              path={FLEET_SETUP_PATH}
              email={created.manager.email}
              setupToken={created.setupToken}
              expiresAt={created.setupTokenExpiresAt}
              emailQueued={created.emailQueued}
            />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a fleet manager</DialogTitle>
              <DialogDescription>
                They are sent a link to choose their password. They see this
                fleet only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manager-email">Email</Label>
                <Input
                  id="manager-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-name">Name (optional)</Label>
                <Input
                  id="manager-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={email.trim().length === 0 || create.isPending}
              >
                {create.isPending ? 'Adding…' : 'Add manager'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A new setup link: a lost invitation or a forgotten password. */
function SetupLinkDialog({
  fleetId,
  manager,
}: {
  fleetId: string;
  manager: FleetManager;
}) {
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<FleetManagerSetupToken | null>(null);
  const kind = manager.lastSignInAt ? 'reset' : 'invitation';

  const issue = useMutation({
    mutationFn: () =>
      apiSend<FleetManagerSetupToken>(
        'POST',
        `/fleets/${fleetId}/managers/${manager.id}/setup-token`,
      ),
    onSuccess: setIssued,
    onError: (error: Error) => toast.error(error.message),
  });

  function close() {
    setOpen(false);
    setIssued(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        New link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A new setup link for {manager.email}</DialogTitle>
          <DialogDescription>
            Any earlier link stops working.
          </DialogDescription>
        </DialogHeader>
        {issued ? (
          <SetupLink
            kind={kind}
            path={FLEET_SETUP_PATH}
            email={manager.email}
            setupToken={issued.setupToken}
            expiresAt={issued.setupTokenExpiresAt}
            emailQueued={issued.emailQueued}
          />
        ) : null}
        <DialogFooter>
          {issued ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
              {issue.isPending ? 'Issuing…' : 'Issue link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
