'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Failed } from '@/components/driver-query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { WalletDto, WithdrawalDto, WithdrawalPage } from '@/lib/api/driver-types';
import { dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Where withdrawn money goes, in the driver's words. Razorpay pays it back as
 * a refund of the top-ups it came from, at normal speed — which Razorpay
 * gives as 5–7 working days for the bank to show it.
 */
const WHERE_IT_GOES =
  'It goes back to the card, UPI or bank account you topped up with — the most recent top-ups first — and usually shows there within 5–7 working days.';

/**
 * `charveta` doc 6 §22.4: taking wallet money back to the bank. Only what
 * came from the driver's own top-ups can go back — money an operator credited
 * by hand has no card to return to — and the API is what decides how much
 * that is (`withdrawableMinor`); this only shows it.
 */
export function WithdrawDialog({ wallet }: { wallet: WalletDto }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const queryClient = useQueryClient();
  const none = wallet.withdrawableMinor === '0';

  const withdraw = useMutation({
    mutationFn: () => {
      const amountMinor = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error('Enter an amount.');
      }
      return driverApiSend<WithdrawalDto>('POST', '/driver/wallet/withdrawals', {
        amountMinor,
      });
    },
    onSuccess: (withdrawal) => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'wallet'] });
      setOpen(false);
      setAmount('');
      toast.success(
        `${money(withdrawal.amountMinor, withdrawal.currency)} is on its way to your bank.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full" disabled={none} />}>
        Withdraw to bank
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw to your bank</DialogTitle>
          <DialogDescription>
            Up to {money(wallet.withdrawableMinor, wallet.currency)}. {WHERE_IT_GOES}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="withdraw-amount">Amount ({wallet.currency})</Label>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setAmount((Number(wallet.withdrawableMinor) / 100).toFixed(2))}
            >
              All of it
            </Button>
          </div>
          <Input
            id="withdraw-amount"
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={(Number(wallet.withdrawableMinor) / 100).toFixed(2)}
          />
          <p className="text-muted-foreground text-xs">
            Not while a session is charging or a card hold is being settled.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => withdraw.mutate()} disabled={withdraw.isPending || !amount}>
            {withdraw.isPending ? 'Sending…' : 'Withdraw'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The driver's withdrawals, once they have any. */
export function WithdrawalsSection() {
  const withdrawals = useQuery({
    queryKey: ['driver', 'wallet', 'withdrawals'],
    queryFn: () => driverApiGet<WithdrawalPage>('/driver/wallet/withdrawals', { limit: '10' }),
  });

  if (withdrawals.isError) return <Failed error={withdrawals.error} />;
  const items = withdrawals.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="mt-4 space-y-2">
      <h2 className="text-sm font-medium">Withdrawals</h2>
      {items.map((withdrawal) => (
        <WithdrawalRow key={withdrawal.id} withdrawal={withdrawal} />
      ))}
    </section>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  processing: {
    label: 'On its way',
    tone: 'border-primary/20 bg-primary/5 text-primary',
  },
  completed: {
    label: 'Sent',
    tone: 'border-ok/30 bg-ok/10 text-ok-ink',
  },
  partially_returned: {
    label: 'Partly returned',
    tone: 'border-caution/30 bg-caution/10 text-caution-ink',
  },
  returned: {
    label: 'Returned to wallet',
    tone: 'border-caution/30 bg-caution/10 text-caution-ink',
  },
};

const METHOD: Record<string, string> = {
  card: 'card',
  upi: 'UPI',
  netbanking: 'bank account',
  wallet: 'wallet app',
};

function WithdrawalRow({ withdrawal }: { withdrawal: WithdrawalDto }) {
  const status = STATUS[withdrawal.status] ?? { label: withdrawal.status, tone: '' };
  const methods = [
    ...new Set(withdrawal.parts.map((part) => METHOD[part.method ?? ''] ?? 'original payment')),
  ];
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{money(withdrawal.amountMinor, withdrawal.currency)}</span>
          <Badge variant="outline" className={cn('font-medium', status.tone)}>
            {status.label}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {dateTime(withdrawal.createdAt)} · to your {methods.join(' and ')}
        </p>
        {withdrawal.returnedMinor !== '0' ? (
          <p className="text-xs">
            {money(withdrawal.returnedMinor, withdrawal.currency)} could not be sent and is back in
            your wallet.
          </p>
        ) : null}
        {withdrawal.status === 'processing' ? (
          <p className="text-muted-foreground text-xs">
            Banks usually show a refund within 5–7 working days.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
