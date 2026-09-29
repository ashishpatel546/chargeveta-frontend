'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { OwnerLink } from './owner-link';
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
import { ApiError } from '@/lib/api/client';
import { platformApiSend } from '@/lib/api/platform-client';
import type { CreatedTenant } from '@/lib/api/platform-types';

/** The API's slug rule: lowercase letters and digits, single hyphens between. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
}

/**
 * Creates an operator and its first owner. The owner is never given a
 * password here: they are sent a setup link and choose one themselves.
 */
export function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  // Until the slug is typed in by hand, it follows the name.
  const [slugEdited, setSlugEdited] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [created, setCreated] = useState<{ email: string; result: CreatedTenant } | null>(
    null,
  );
  const queryClient = useQueryClient();

  const slugValue = slugEdited ? slug : slugify(name);
  const slugValid = SLUG.test(slugValue) && slugValue.length <= 100;

  const create = useMutation({
    mutationFn: () =>
      platformApiSend<CreatedTenant>('POST', '/tenants', {
        name: name.trim(),
        slug: slugValue,
        ownerEmail: ownerEmail.trim(),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      setCreated({ email: ownerEmail.trim(), result });
      setName('');
      setSlug('');
      setSlugEdited(false);
      setOwnerEmail('');
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError && error.status === 409
          ? `${error.message} Pick another slug.`
          : error.message,
      ),
  });

  function close() {
    setOpen(false);
    // The token is never kept: once this closes it is gone.
    setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button />}>Create tenant</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.result.tenant.name} has been created</DialogTitle>
              <DialogDescription>
                Its owner, {created.email}, chooses their password from the
                link and can then invite everyone else.
              </DialogDescription>
            </DialogHeader>
            <OwnerLink email={created.email} link={created.result} kind="invitation" />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create a tenant</DialogTitle>
              <DialogDescription>
                A new operator, with one owner who is sent a link to set their
                password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Name</Label>
                <Input
                  id="tenant-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Charging"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Slug</Label>
                <Input
                  id="tenant-slug"
                  value={slugValue}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(event.target.value);
                  }}
                  placeholder="acme-charging"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={100}
                  aria-invalid={slugValue.length > 0 && !slugValid}
                />
                <p className="text-muted-foreground text-xs">
                  What staff type to sign in. Lowercase letters and digits,
                  with single hyphens between. It cannot be changed later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant-owner">Owner email</Label>
                <Input
                  id="tenant-owner"
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  placeholder="owner@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  name.trim().length === 0 ||
                  !slugValid ||
                  ownerEmail.trim().length === 0 ||
                  create.isPending
                }
              >
                {create.isPending ? 'Creating…' : 'Create tenant'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
