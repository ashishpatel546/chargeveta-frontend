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
import { toExpiryIso } from './expiry';

/**
 * Issues a card.
 *
 * There is no state to pick: the API derives Accepted, Blocked and Expired from
 * the facts it is given, so a new card is accepted unless the expiry already
 * passed. The token itself can never be changed afterwards — a card with a new
 * number is a new row — so it is the one field worth explaining.
 */
export function AddCardDialog() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [tokenType, setTokenType] = useState('');
  const [label, setLabel] = useState('');
  const [expiryDay, setExpiryDay] = useState('');
  const [groupId, setGroupId] = useState('');
  const [priority, setPriority] = useState('');
  const queryClient = useQueryClient();

  const priorityNumber = priority.trim() === '' ? undefined : Number(priority);
  const priorityValid =
    priorityNumber === undefined ||
    (Number.isInteger(priorityNumber) &&
      priorityNumber >= -9 &&
      priorityNumber <= 9);

  function reset() {
    setToken('');
    setTokenType('');
    setLabel('');
    setExpiryDay('');
    setGroupId('');
    setPriority('');
  }

  const create = useMutation({
    mutationFn: () =>
      apiSend<IdToken>('POST', '/id-tokens', {
        token: token.trim(),
        ...(tokenType.trim() ? { tokenType: tokenType.trim() } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(toExpiryIso(expiryDay) ? { expiresAt: toExpiryIso(expiryDay) } : {}),
        ...(groupId.trim() ? { groupId: groupId.trim() } : {}),
        ...(priorityNumber === undefined
          ? {}
          : { chargingPriority: priorityNumber }),
      }),
    onSuccess: (card) => {
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
      setOpen(false);
      reset();
      toast.success(`${card.token} added.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add card</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a card</DialogTitle>
          <DialogDescription>
            Chargers are answered from this list the next time the card is
            presented.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="A1B2C3D4"
              spellCheck={false}
              maxLength={255}
            />
            <p className="text-muted-foreground text-xs">
              The number printed on the card, or the key code. Matched without
              regard to case, and it cannot be changed afterwards.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-type">Type</Label>
            <Input
              id="token-type"
              value={tokenType}
              onChange={(event) => setTokenType(event.target.value)}
              placeholder="ISO14443"
              spellCheck={false}
              maxLength={20}
            />
            <p className="text-muted-foreground text-xs">
              OCPP 2.x names the kind of identifier: <code>ISO14443</code> for
              most RFID cards, <code>KeyCode</code> for a keypad,{' '}
              <code>eMAID</code> for a roaming contract. Optional.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Depot spare #4"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Expires</Label>
            <Input
              id="expiry"
              type="date"
              value={expiryDay}
              onChange={(event) => setExpiryDay(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              The card works to the end of that day. Leave empty for no end
              date.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group">Group</Label>
            <Input
              id="group"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              spellCheck={false}
              maxLength={255}
            />
            <p className="text-muted-foreground text-xs">
              The fleet card this one belongs to, by its token. It need not be a
              card on this list.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Charging priority</Label>
            <Input
              id="priority"
              type="number"
              min={-9}
              max={9}
              step={1}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-invalid={!priorityValid}
            />
            <p className="text-muted-foreground text-xs">
              −9 to 9, OCPP 2.x only. Higher charges first when a site runs out
              of power to share.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={
              token.trim().length === 0 || !priorityValid || create.isPending
            }
          >
            {create.isPending ? 'Adding…' : 'Add card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
