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
import type { CreditNote, Receipt } from '@/lib/api/types';
import { money } from '@/lib/format';

/**
 * Crediting a receipt.
 *
 * A receipt is a document a customer holds, so it is never edited: crediting
 * writes a second, numbered document beside it and cannot be taken back. The
 * amount is net — the tax follows at the receipt's own rate — and how much is
 * left is the API's `remainingNetMinor`, never a subtraction done here.
 */
export function CreditNoteDialog({ receipt }: { receipt: Receipt }) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(true);
  const [netMinor, setNetMinor] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const credit = useMutation({
    mutationFn: () => {
      if (!whole && !/^[1-9][0-9]{0,17}$/.test(netMinor.trim())) {
        throw new Error(
          'The amount is a whole number of minor units, and above zero',
        );
      }
      return apiSend<CreditNote>(
        'POST',
        `/receipts/${receipt.id}/credit-notes`,
        {
          ...(whole ? {} : { netMinor: netMinor.trim() }),
          note: note.trim(),
        },
      );
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['receipt', receipt.id] });
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      setOpen(false);
      setNote('');
      setNetMinor('');
      toast.success(`${created.documentNumber} issued.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remaining = money(receipt.remainingNetMinor, receipt.currency);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        Credit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credit {receipt.documentNumber}</DialogTitle>
          <DialogDescription>
            This issues a credit note against the receipt. Neither document can
            be changed or removed afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">
              Still creditable: <span className="font-medium">{remaining}</span>{' '}
              net.
            </p>

            <div className="flex items-start gap-2">
              <input
                id="credit-whole"
                type="radio"
                checked={whole}
                onChange={() => setWhole(true)}
                className="accent-primary mt-0.5 size-4"
              />
              <Label htmlFor="credit-whole">
                Everything that is left ({remaining})
              </Label>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="credit-part"
                type="radio"
                checked={!whole}
                onChange={() => setWhole(false)}
                className="accent-primary mt-0.5 size-4"
              />
              <Label htmlFor="credit-part">Part of it</Label>
            </div>
          </div>

          {!whole ? (
            <div className="space-y-2">
              <Label htmlFor="credit-amount">
                Net amount, in minor units of {receipt.currency}
              </Label>
              <Input
                id="credit-amount"
                value={netMinor}
                onChange={(event) => setNetMinor(event.target.value)}
                placeholder="1250"
                inputMode="numeric"
                spellCheck={false}
                className="max-w-40"
              />
              <p className="text-muted-foreground text-xs">
                Before tax; the tax is credited at the receipt’s rate. More than
                is left is refused.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="credit-note">Why</Label>
            <Input
              id="credit-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Charger stopped mid-session; refunded"
              maxLength={300}
            />
            <p className="text-muted-foreground text-xs">
              Kept on the credit note, and read by whoever asks about it later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => credit.mutate()}
            disabled={note.trim().length === 0 || credit.isPending}
          >
            {credit.isPending ? 'Issuing…' : 'Issue credit note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
