'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDriver } from '@/components/driver-context';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type {
  CheckoutDto,
  PaymentDto,
  WalletDto,
  WalletEntryDto,
  WalletEntryPage,
} from '@/lib/api/driver-types';
import { dateTime, money } from '@/lib/format';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';
import { WithdrawDialog, WithdrawalsSection } from './withdrawals';

/** Doc 6 §22.4: the driver's own balance, a way to top it up, and its ledger. */
export function WalletView() {
  const wallet = useQuery({
    queryKey: ['driver', 'wallet'],
    queryFn: () => driverApiGet<WalletDto>('/driver/wallet'),
  });

  const entries = useInfiniteQuery({
    queryKey: ['driver', 'wallet', 'entries'],
    queryFn: ({ pageParam }) =>
      driverApiGet<WalletEntryPage>('/driver/wallet/entries', { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entryRows = entries.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="Wallet" description="Money you have added, used to pay for charging." />

      {wallet.isPending ? <Loading rows={1} /> : null}
      {wallet.isError ? <Failed error={wallet.error} /> : null}

      {wallet.isSuccess ? <BalanceCard wallet={wallet.data} /> : null}

      <WithdrawalsSection />

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Recent activity</h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          render={<Link href="/driver/wallet/payments" />}
          nativeButton={false}
        >
          All payments
        </Button>
      </div>

      {entries.isPending ? <Loading rows={2} /> : null}
      {entries.isError ? <Failed error={entries.error} /> : null}
      {entries.isSuccess && entryRows.length === 0 ? (
        <Empty>No wallet activity yet.</Empty>
      ) : null}

      <div className="space-y-2">
        {entryRows.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
      </div>

      {entries.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void entries.fetchNextPage()}
          disabled={entries.isFetchingNextPage}
        >
          {entries.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}

function BalanceCard({ wallet }: { wallet: WalletDto }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div>
          <p className="text-muted-foreground text-xs">Balance</p>
          <p className="text-2xl font-semibold">{money(wallet.balanceMinor, wallet.currency)}</p>
          {wallet.enabled && wallet.withdrawableMinor !== wallet.balanceMinor ? (
            <p className="text-muted-foreground text-xs">
              {money(wallet.withdrawableMinor, wallet.currency)} can go back to your bank
            </p>
          ) : null}
        </div>
        {wallet.enabled ? (
          <div className="space-y-2">
            <TopUpDialog wallet={wallet} />
            <WithdrawDialog wallet={wallet} />
          </div>
        ) : (
          <Alert>
            <AlertTitle>Top-ups are off</AlertTitle>
            <AlertDescription>
              Your operator has not switched on wallet payments yet.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function TopUpDialog({ wallet }: { wallet: WalletDto }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const driver = useDriver();
  const queryClient = useQueryClient();

  const min = Number(wallet.topUpMinMinor) / 100;
  const max = Number(wallet.topUpMaxMinor) / 100;

  const topUp = useMutation({
    mutationFn: async () => {
      const amountMinor = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error('Enter an amount.');
      }
      const checkout = await driverApiSend<CheckoutDto>('POST', '/driver/wallet/top-ups', {
        amountMinor,
      });
      const paid = await openRazorpayCheckout({
        keyId: checkout.keyId,
        orderId: checkout.orderId,
        amountMinor: checkout.amountMinor,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        email: checkout.email ?? driver.email ?? undefined,
        contact: checkout.contact ?? driver.phone ?? undefined,
        // Straight away, while Checkout is still open to try another way.
        onPaymentFailed: (message) => toast.error(message),
      });
      return driverApiSend<PaymentDto>(
        'POST',
        `/driver/wallet/top-ups/${checkout.payment.id}/confirm`,
        paid,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'wallet'] });
      setOpen(false);
      setAmount('');
      toast.success(
        'Payment received. Your balance updates once Razorpay confirms it.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full" />}>Add money</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add money to your wallet</DialogTitle>
          <DialogDescription>
            Between {money(wallet.topUpMinMinor, wallet.currency)} and{' '}
            {money(wallet.topUpMaxMinor, wallet.currency)}, paid through Razorpay Checkout.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="top-up-amount">Amount ({wallet.currency})</Label>
          <Input
            id="top-up-amount"
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={min.toFixed(2)}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => topUp.mutate()} disabled={topUp.isPending || !amount}>
            {topUp.isPending ? 'Opening Checkout…' : 'Pay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ENTRY_LABEL: Record<string, string> = {
  top_up: 'Top-up',
  charge: 'Charging',
  adjustment: 'Adjustment',
  withdrawal: 'Withdrawal to bank',
  withdrawal_reversal: 'Withdrawal returned',
};

function EntryRow({ entry }: { entry: WalletEntryDto }) {
  const negative = entry.amountMinor.startsWith('-');
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{ENTRY_LABEL[entry.kind] ?? entry.kind}</p>
          <p className="text-muted-foreground truncate text-xs">
            {dateTime(entry.createdAt)}
            {entry.note ? ` · ${entry.note}` : ''}
          </p>
        </div>
        <span
          className={negative ? 'text-sm font-medium' : 'text-sm font-medium text-emerald-700 dark:text-emerald-400'}
        >
          {money(entry.amountMinor, entry.currency)}
        </span>
      </CardContent>
    </Card>
  );
}
