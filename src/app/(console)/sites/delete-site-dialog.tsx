'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { apiSend } from '@/lib/api/client';
import type { Site } from '@/lib/api/types';

export function DeleteSiteDialog({ site }: { site: Site }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => apiSend<void>('DELETE', `/locations/${site.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      // A charger's site is cleared by this, so the charger list is stale too.
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      setOpen(false);
      toast.success(`${site.name} deleted.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {site.name}?</DialogTitle>
          <DialogDescription>
            The chargers here are kept — deleting a site does not delete
            hardware that still exists — but they are left with no site, and so
            with no tariff, tax rate or time zone from one until they are given
            another. Sessions already billed are not affected.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Deleting…' : 'Delete site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
