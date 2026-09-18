'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
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

/**
 * Adds somebody to the console.
 *
 * Leaving the password blank is what makes it an invitation: the API emails
 * them a setup link when this installation sends mail, and hands the link back
 * here either way, so it can be passed on by hand if the email goes astray or
 * there is no mail server at all (doc 6 §22.2).
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
                They choose their own password from the link.
              </DialogDescription>
            </DialogHeader>
            <SetupLink
              kind="invitation"
              email={created.email}
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
              <DialogTitle>Add a person</DialogTitle>
              <DialogDescription>
                Leave the password blank to invite them: they are sent a link
                and choose the password themselves.
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
