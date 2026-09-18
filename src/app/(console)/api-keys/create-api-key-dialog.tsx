'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SecretOnce } from '../_shared/copy';
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
import type { CreatedApiKey } from '@/lib/api/types';

type KeyRole = 'viewer' | 'operator' | 'admin';

/**
 * Issues a key for an integration.
 *
 * The dialog has two faces: the form, and then the key itself. The key is only
 * ever in the API's answer, so the form is replaced rather than closed — a
 * dialog that vanished on success would take the key with it.
 */
export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<KeyRole>('viewer');
  const [expiresAt, setExpiresAt] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      apiSend<CreatedApiKey>('POST', '/api-keys', {
        name: name.trim(),
        role,
        // The field is a local `datetime-local` value, which has no zone; the
        // API wants an instant, so it is read in the reader's own zone.
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      }),
    onSuccess: (key) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreated(key);
      setName('');
      setRole('viewer');
      setExpiresAt('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function close() {
    setOpen(false);
    setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button />}>New key</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.name} is ready</DialogTitle>
              <DialogDescription>
                Copy the key into whatever is going to use it before you close
                this.
              </DialogDescription>
            </DialogHeader>
            <SecretOnce
              title="API key"
              value={created.key}
              note={
                <>
                  Send it as <code>Authorization: Bearer &lt;key&gt;</code>.
                </>
              }
            />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New API key</DialogTitle>
              <DialogDescription>
                The key is shown once, when it is made, and never again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Billing export"
                  maxLength={100}
                  spellCheck={false}
                />
                <p className="text-muted-foreground text-xs">
                  What is using it. This is all you will have to recognise it by
                  later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole((value as KeyRole | null) ?? 'viewer')}
                >
                  <SelectTrigger id="key-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">viewer</SelectItem>
                    <SelectItem value="operator">operator</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Give it the weakest role that does the job. A key cannot be an
                  owner.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-expires">Expires (optional)</Label>
                <Input
                  id="key-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Leave it empty for a key that does not expire on its own.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={name.trim().length === 0 || create.isPending}
              >
                {create.isPending ? 'Making…' : 'Make key'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
