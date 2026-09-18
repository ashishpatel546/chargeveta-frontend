'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SecretOnce } from '../_shared/copy';
import { usePrincipal } from '@/components/principal-context';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiSend } from '@/lib/api/client';
import { atLeast, ROLES, type CreatedUser, type Role } from '@/lib/api/types';
import { dateTime } from '@/lib/format';

/**
 * Adds somebody to the console.
 *
 * Leaving the password blank is what makes it an invitation: the API answers
 * with a setup token instead, which is the only way they can set a password.
 * Nothing sends it for us yet, so the token is put on screen to be handed over.
 */
export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const principal = usePrincipal();
  const queryClient = useQueryClient();

  const grantable = ROLES.filter((candidate) => atLeast(principal.role, candidate));

  const create = useMutation({
    mutationFn: () =>
      apiSend<CreatedUser>('POST', '/users', {
        email: email.trim(),
        role,
        ...(password.length > 0 ? { password } : {}),
      }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setEmail('');
      setPassword('');
      setRole('viewer');
      if (user.setupToken) setCreated(user);
      else {
        setOpen(false);
        toast.success(`${user.email} can sign in with the password you set.`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function close() {
    setOpen(false);
    // The token is never kept: once this closes it is gone.
    setCreated(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger render={<Button />}>Add person</DialogTrigger>
      <DialogContent>
        {created?.setupToken ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.email} has been added</DialogTitle>
              <DialogDescription>
                No email goes out yet, so send this token to them yourself. They
                set their own password with it.
              </DialogDescription>
            </DialogHeader>
            <SecretOnce
              title="Setup token"
              value={created.setupToken}
              note={
                created.setupTokenExpiresAt ? (
                  <>It stops working {dateTime(created.setupTokenExpiresAt)}.</>
                ) : null
              }
            />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a person</DialogTitle>
              <DialogDescription>
                Leave the password blank to invite them: you get a setup token
                to pass on, and they choose the password themselves.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole((value as Role | null) ?? 'viewer')}
                >
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grantable.map((candidate) => (
                      <SelectItem key={candidate} value={candidate}>
                        {candidate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Viewer reads, operator also runs chargers, admin also manages
                  people and keys. You cannot give somebody a role above your
                  own.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-password">Password (optional)</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-muted-foreground text-xs">
                  Set one only if you are handing it over in person. Blank is
                  the usual choice.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={email.trim().length === 0 || create.isPending}
              >
                {create.isPending ? 'Adding…' : 'Add person'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
