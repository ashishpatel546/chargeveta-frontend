'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../_shared/confirm-dialog';
import { SetupLink } from '../_shared/setup-link';
import { usePrincipal } from '@/components/principal-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, apiSend } from '@/lib/api/client';
import {
  atLeast,
  ROLES,
  type ConsoleUser,
  type IssuedSetupToken,
  type Role,
} from '@/lib/api/types';

/**
 * Turns the API's refusals into the reason behind them.
 *
 * The console hides the controls it knows will be refused, but the rules live
 * on the server and a stale page can still ask for something it should not, so
 * the answer has to explain itself.
 */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : 'That did not work.';
  if (!(error instanceof ApiError)) return message;
  if (error.status === 409) {
    return `${message} The last active owner cannot be deactivated — somebody has to be able to manage the operator.`;
  }
  if (error.status === 403) {
    return `${message} Nobody can change their own account, and an admin cannot change another admin or an owner.`;
  }
  return message;
}

export function UserActions({ user }: { user: ConsoleUser }) {
  const principal = usePrincipal();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<IssuedSetupToken | null>(null);

  const isSelf = principal.kind === 'user' && principal.userId === user.id;
  // An admin is only allowed to act on people below the admin rung; an owner
  // may act on anyone but themselves.
  const outranks = !(principal.role === 'admin' && atLeast(user.role, 'admin'));
  const mayManage = !isSelf && outranks;

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['users'] });

  const patch = useMutation({
    mutationFn: (body: { role?: Role; isActive?: boolean }) =>
      apiSend<ConsoleUser>('PATCH', `/users/${user.id}`, body),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(explain(error)),
  });

  const newToken = useMutation({
    mutationFn: () =>
      apiSend<IssuedSetupToken>('POST', `/users/${user.id}/setup-token`),
    onSuccess: (result) => setToken(result),
    onError: (error: Error) => toast.error(explain(error)),
  });

  const revoke = useMutation({
    mutationFn: () =>
      apiSend<{ revoked: number }>('POST', `/users/${user.id}/sessions/revoke`),
    onSuccess: ({ revoked }) =>
      toast.success(
        revoked === 0
          ? 'They had no sessions open.'
          : `Signed out of ${revoked} session${revoked === 1 ? '' : 's'}.`,
      ),
    onError: (error: Error) => toast.error(explain(error)),
  });

  if (isSelf) {
    return (
      <span className="text-muted-foreground text-xs">
        This is you. Someone else has to change your account.
      </span>
    );
  }

  if (!mayManage) {
    return (
      <span className="text-muted-foreground text-xs">
        Only an owner can change an admin or an owner.
      </span>
    );
  }

  // Nobody can hand out a role above their own.
  const grantable = ROLES.filter((role) => atLeast(principal.role, role));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={user.role}
        disabled={patch.isPending}
        onValueChange={(value) => {
          if (value === null || value === user.role) return;
          patch.mutate({ role: value as Role });
        }}
      >
        <SelectTrigger size="sm" aria-label={`Role for ${user.email}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {grantable.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {user.isActive ? (
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel="Deactivate"
          title={`Deactivate ${user.email}?`}
          description="They will be signed out everywhere immediately and will not be able to sign in again until you reactivate them."
          confirmLabel="Deactivate"
          pending={patch.isPending}
          onConfirm={() => patch.mutateAsync({ isActive: false })}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={patch.isPending}
          onClick={() => patch.mutate({ isActive: true })}
        >
          Reactivate
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={newToken.isPending}
        onClick={() => newToken.mutate()}
      >
        {newToken.isPending ? 'Working…' : 'New setup link'}
      </Button>

      <ConfirmDialog
        trigger={<Button variant="outline" size="sm" />}
        triggerLabel="Sign out everywhere"
        title={`Sign ${user.email} out everywhere?`}
        description="Every session they have open ends. They keep their account and can sign in again."
        confirmLabel="Sign them out"
        pending={revoke.isPending}
        onConfirm={() => revoke.mutateAsync()}
      />

      <Dialog open={token !== null} onOpenChange={(open) => !open && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {user.email}</DialogTitle>
            <DialogDescription>
              They choose it themselves from the link. Any earlier link stops
              working.
            </DialogDescription>
          </DialogHeader>
          {token ? (
            <SetupLink
              kind="reset"
              email={user.email}
              setupToken={token.setupToken}
              expiresAt={token.setupTokenExpiresAt}
              emailQueued={token.emailQueued}
            />
          ) : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
