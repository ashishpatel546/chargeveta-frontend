'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { AdminSetupLink } from './setup-link';
import { ConfirmDialog } from '@/app/(console)/_shared/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import { ApiError } from '@/lib/api/client';
import { platformApiGet, platformApiSend } from '@/lib/api/platform-client';
import type {
  CreatedPlatformAdmin,
  PlatformAdmin,
  PlatformAdminSetupLink,
} from '@/lib/api/platform-types';
import { dateTime } from '@/lib/format';

const ADMINS = ['platform', 'admins'] as const;

/**
 * The people who run the platform (doc 6 §19.4). Nobody's password passes
 * through here: a new admin, and one who has forgotten theirs, is given a
 * single-use link to choose their own. The API refuses deactivating yourself
 * and the last active admin; the buttons are hidden for the first only
 * because that one is known here.
 */
export function PlatformAdminsView({ meId }: { meId: string }) {
  const admins = useQuery({
    queryKey: ADMINS,
    queryFn: () => platformApiGet<PlatformAdmin[]>('/admins'),
  });

  return (
    <>
      <PageHeader
        title="Admins"
        description="Everyone who can sign in to this platform console. Deactivating someone signs them out everywhere at once."
      >
        <AddAdminDialog />
      </PageHeader>

      {admins.isPending ? <Loading /> : null}
      {admins.isError ? <Failed error={admins.error} /> : null}
      {admins.isSuccess && admins.data.length === 0 ? (
        <Empty>No platform admins.</Empty>
      ) : null}

      {admins.isSuccess && admins.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last signed in</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.data.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="font-medium">{admin.name ?? admin.email}</div>
                    {admin.name ? (
                      <div className="text-muted-foreground text-xs">{admin.email}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <AdminStatus admin={admin} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {admin.lastSignInAt ? dateTime(admin.lastSignInAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-sm">{dateTime(admin.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal">
                    {admin.id === meId ? (
                      <span className="text-muted-foreground text-sm">You</span>
                    ) : (
                      <AdminActions admin={admin} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

function AdminStatus({ admin }: { admin: PlatformAdmin }) {
  if (!admin.isActive) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        deactivated
      </Badge>
    );
  }
  if (admin.setupLinkExpiresAt && !admin.lastSignInAt) {
    return (
      <Badge
        variant="outline"
        className="border-amber-600/30 bg-amber-600/10 font-medium text-amber-700 dark:text-amber-400"
      >
        link not used yet
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
    >
      active
    </Badge>
  );
}

function AddAdminDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedPlatformAdmin | null>(null);
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: () =>
      platformApiSend<CreatedPlatformAdmin>('POST', '/admins', {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ADMINS });
      setCreated(result);
      setEmail('');
      setName('');
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError && error.status === 409
          ? 'There is already a platform admin with that email.'
          : error.message,
      ),
  });

  function close() {
    setOpen(false);
    // The link is never kept: once this closes it is gone.
    setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button />}>Add admin</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.admin.email} has been added</DialogTitle>
              <DialogDescription>
                They choose their password from this link, and are signed in
                straight after.
              </DialogDescription>
            </DialogHeader>
            <AdminSetupLink email={created.admin.email} link={created} />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a platform admin</DialogTitle>
              <DialogDescription>
                They can do everything you can: create and suspend tenants, and
                manage the other admins.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="someone@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Name (optional)</Label>
                <Input
                  id="admin-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => add.mutate()}
                disabled={email.trim().length === 0 || add.isPending}
              >
                {add.isPending ? 'Adding…' : 'Add admin'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminActions({ admin }: { admin: PlatformAdmin }) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState<PlatformAdminSetupLink | null>(null);
  const label = admin.name ?? admin.email;

  const setActive = useMutation({
    mutationFn: (isActive: boolean) =>
      platformApiSend<PlatformAdmin>('PATCH', `/admins/${admin.id}`, { isActive }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ADMINS });
      toast.success(
        result.isActive ? `${label} can sign in again.` : `${label} is deactivated.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: () =>
      platformApiSend<PlatformAdminSetupLink>('POST', `/admins/${admin.id}/setup-token`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ADMINS });
      setLink(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {admin.isActive ? (
        <>
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm" />}
            triggerLabel="Reset password"
            title={`Reset ${label}'s password?`}
            description="They are signed out everywhere now and get a new single-use link to choose a password from. Their current password keeps working until the link is used."
            confirmLabel="Issue reset link"
            pending={reset.isPending}
            onConfirm={() => reset.mutateAsync()}
          />
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm" />}
            triggerLabel="Deactivate"
            title={`Deactivate ${label}?`}
            description="They are signed out everywhere at once and cannot sign in again until reactivated. The last active admin cannot be deactivated."
            confirmLabel="Deactivate"
            pending={setActive.isPending}
            onConfirm={() => setActive.mutateAsync(false)}
          />
        </>
      ) : (
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel="Reactivate"
          title={`Reactivate ${label}?`}
          description="They can sign in again with their existing password."
          confirmLabel="Reactivate"
          pending={setActive.isPending}
          onConfirm={() => setActive.mutateAsync(true)}
        />
      )}

      <Dialog open={link !== null} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New link for {admin.email}</DialogTitle>
            <DialogDescription>
              Any earlier link for them has stopped working, and so have their
              sessions.
            </DialogDescription>
          </DialogHeader>
          {link ? <AdminSetupLink email={admin.email} link={link} /> : null}
          <DialogFooter>
            <Button onClick={() => setLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
