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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiSend } from '@/lib/api/client';
import type { Tariff } from '@/lib/api/types';

/** The name is the only thing about a tariff that changes in place. */
export function RenameTariffDialog({ tariff }: { tariff: Tariff }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tariff.name);
  const queryClient = useQueryClient();

  const rename = useMutation({
    mutationFn: () =>
      apiSend<Tariff>('PATCH', `/tariffs/${tariff.id}`, { name: name.trim() }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['tariff', tariff.id] });
      void queryClient.invalidateQueries({ queryKey: ['tariffs'] });
      setOpen(false);
      toast.success(`Renamed to ${updated.name}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(tariff.name);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Rename</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename this tariff</DialogTitle>
          <DialogDescription>
            Only the name changes. Prices change by adding a version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rename-tariff">Name</Label>
          <Input
            id="rename-tariff"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
          />
        </div>

        <DialogFooter>
          <Button
            onClick={() => rename.mutate()}
            disabled={
              name.trim().length === 0 ||
              name.trim() === tariff.name ||
              rename.isPending
            }
          >
            {rename.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
