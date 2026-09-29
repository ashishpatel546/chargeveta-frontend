'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiSend } from '@/lib/api/client';
import type { AttentionPayment, PaymentRefund } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Driver payments that need a person (`charveta` doc 6 §22.4): the worker
 * stopped being able to finish them by itself — Razorpay would not answer or
 * kept refusing until its attempts were spent, or a refund failed every time
 * it was asked. Each was also raised as an alert; this is the list that stays
 * until it is dealt with.
 *
 * "Try again" is an admin's (the API enforces it; the button is only hidden
 * here): it clears the attempt count, and a refund that failed every time is
 * asked of Razorpay once more.
 */
export function AttentionBoard() {
  const canRetry = useCan('admin');
  const queryClient = useQueryClient();

  const attention = useQuery({
    queryKey: ['payments', 'attention'],
    queryFn: () => apiGet<AttentionPayment[]>('/payments/attention'),
    refetchInterval: 15_000,
  });

  const retry = useMutation({
    mutationFn: (id: string) =>
      apiSend<AttentionPayment>('POST', `/payments/${id}/retry`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Asked again. The worker picks it up within seconds.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Payments needing attention"
        description="Driver top-ups, card holds and refunds that Razorpay would not finish, after every automatic retry."
      />

      {attention.isPending ? <Loading rows={3} /> : null}
      {attention.isError ? <Failed error={attention.error} /> : null}
      {attention.isSuccess && attention.data.length === 0 ? (
        <Empty>Nothing needs attention. Every driver payment is on track.</Empty>
      ) : null}
      {attention.isSuccess && attention.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>What went wrong</TableHead>
                <TableHead>Refunds</TableHead>
                <TableHead>Since</TableHead>
                {canRetry ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {attention.data.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {money(payment.amountMinor, payment.currency)}{' '}
                      {payment.purpose === 'top_up' ? 'top-up' : 'card hold'}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {payment.status}
                      {payment.method ? ` · ${payment.method}` : ''}
                      {payment.razorpayPaymentId
                        ? ` · ${payment.razorpayPaymentId}`
                        : ` · ${payment.razorpayOrderId}`}
                    </div>
                    {payment.transactionId ? (
                      <Link
                        href={`/sessions/${payment.transactionId}`}
                        className="text-xs hover:underline"
                      >
                        Its session
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-md align-top whitespace-normal">
                    <p>{payment.attentionReason ?? 'Needs a look'}</p>
                    {payment.lastError ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Razorpay last said: {payment.lastError}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {payment.syncAttempts} failed{' '}
                      {payment.syncAttempts === 1 ? 'attempt' : 'attempts'}
                      {payment.nextSyncAt
                        ? ` · still retrying, next ${dateTime(payment.nextSyncAt)}`
                        : ' · no longer retrying'}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {payment.refunds.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {payment.refunds.map((refund) => (
                          <RefundLine
                            key={refund.id}
                            refund={refund}
                            currency={payment.currency}
                          />
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    {payment.attentionAt ? dateTime(payment.attentionAt) : '—'}
                  </TableCell>
                  {canRetry ? (
                    <TableCell className="align-top">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(payment.id)}
                      >
                        Try again
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

const REFUND_TONE: Record<PaymentRefund['status'], string> = {
  pending: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400',
  processed:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  failed: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
};

function RefundLine({
  refund,
  currency,
}: {
  refund: PaymentRefund;
  currency: string;
}) {
  return (
    <li className="text-sm">
      <span className="tabular-nums">{money(refund.amountMinor, currency)}</span>{' '}
      <Badge variant="outline" className={cn('font-medium', REFUND_TONE[refund.status])}>
        {refund.status}
      </Badge>{' '}
      <span className="text-muted-foreground text-xs">
        try {refund.attempt}
        {refund.withdrawalId ? ' · withdrawal' : ''}
      </span>
      {refund.failureReason ? (
        <div className="text-muted-foreground text-xs">{refund.failureReason}</div>
      ) : null}
    </li>
  );
}
