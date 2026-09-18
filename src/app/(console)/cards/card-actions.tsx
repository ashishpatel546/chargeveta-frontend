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
import type { IdToken } from '@/lib/api/types';

/**
 * Taking a card out of service, and putting it back.
 *
 * Blocking is the ordinary answer to a lost card: the row keeps its reason and
 * its history, and the driver is told `Blocked`. Deleting is the other dialog
 * here, and is not the same thing — see it for why.
 */
export function BlockCardDialog({
  card,
  size = 'sm',
}: {
  card: IdToken;
  size?: 'sm' | 'default';
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const block = useMutation({
    mutationFn: () =>
      apiSend<IdToken>('PATCH', `/id-tokens/${card.id}`, {
        isBlocked: true,
        ...(reason.trim() ? { blockedReason: reason.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
      void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
      setOpen(false);
      setReason('');
      toast.success(`${card.token} blocked.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={size} />}>
        Block
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block {card.token}</DialogTitle>
          <DialogDescription>
            The card is refused from the next time it is presented. A session
            already running is not interrupted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="blocked-reason">Reason</Label>
          <Input
            id="blocked-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Lost by the driver"
            maxLength={200}
          />
          <p className="text-muted-foreground text-xs">
            Kept on the card and shown against every read it is refused on. The
            charger has no field to carry it, so this is the only place the
            answer to “why was I refused” survives.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => block.mutate()} disabled={block.isPending}>
            {block.isPending ? 'Blocking…' : 'Block card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnblockCardButton({
  card,
  size = 'sm',
}: {
  card: IdToken;
  size?: 'sm' | 'default';
}) {
  const queryClient = useQueryClient();

  const unblock = useMutation({
    mutationFn: () =>
      apiSend<IdToken>('PATCH', `/id-tokens/${card.id}`, {
        isBlocked: false,
        blockedReason: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
      void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
      toast.success(`${card.token} unblocked.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => unblock.mutate()}
      disabled={unblock.isPending}
    >
      {unblock.isPending ? 'Unblocking…' : 'Unblock'}
    </Button>
  );
}

export function DeleteCardDialog({
  card,
  size = 'sm',
  onDeleted,
}: {
  card: IdToken;
  size?: 'sm' | 'default';
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => apiSend<void>('DELETE', `/id-tokens/${card.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
      setOpen(false);
      toast.success(`${card.token} deleted.`);
      onDeleted?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size={size} />}>
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {card.token}?</DialogTitle>
          <DialogDescription>
            The card is answered “Unknown” from then on, which nobody can tell
            apart from a card that was never issued. For a lost or withdrawn
            card, block it instead: that keeps the reason and the history. Past
            reads are not deleted.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Deleting…' : 'Delete card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
