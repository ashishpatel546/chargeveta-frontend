'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { HoldConfirmedDto, PaymentDto } from '@/lib/api/driver-types';
import { dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { STATUS_TONE } from '../payments-view';

const PURPOSE_LABEL: Record<string, string> = {
  top_up: 'Top-up',
  hold: 'Hold',
};

/** One of `PaymentsView`'s rows, in full — doc 6 §22.4. */
export function PaymentDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const payment = useQuery({
    queryKey: ['driver', 'payment', id],
    queryFn: () => driverApiGet<PaymentDto>(`/driver/payments/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['driver', 'payment', id] });
    void queryClient.invalidateQueries({ queryKey: ['driver', 'payments'] });
    void queryClient.invalidateQueries({ queryKey: ['driver', 'wallet'] });
  };

  const cancel = useMutation({
    mutationFn: () =>
      driverApiSend<PaymentDto>('POST', `/driver/charging/holds/${id}/cancel`),
    onSuccess: () => {
      invalidate();
      toast.success(
        'Hold cancelled. Razorpay returns the money at its own expiry, not before.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retryStart = useMutation({
    mutationFn: () =>
      driverApiSend<HoldConfirmedDto>('POST', `/driver/charging/holds/${id}/start`),
    onSuccess: (result) => {
      invalidate();
      if (result.command?.outcome === 'answered' && result.command.status === 'Accepted') {
        toast.success('Charging started.');
      } else if (result.command?.outcome === 'answered') {
        toast.error(`The charger said ${result.command.status}.`);
      } else if (result.command) {
        toast.error(
          `The charger did not confirm (${result.command.outcome.replace(/_/g, ' ')}).`,
        );
      } else {
        toast('This hold was already used to start a session.');
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (payment.isPending) return <Loading />;
  if (payment.isError) return <Failed error={payment.error} />;

  const doc = payment.data;
  const canAct = doc.purpose === 'hold' && doc.status === 'authorized';

  return (
    <>
      <PageHeader title={PURPOSE_LABEL[doc.purpose] ?? doc.purpose} />

      <div className="space-y-4">
        <Card size="sm">
          <CardContent className="space-y-2 text-sm">
            <Row label="Status">
              <Badge variant="outline" className={cn('font-medium', STATUS_TONE[doc.status])}>
                {doc.status}
              </Badge>
            </Row>
            <Row label="Amount">{money(doc.amountMinor, doc.currency)}</Row>
            {doc.capturedMinor !== '0' ? (
              <Row label="Captured">{money(doc.capturedMinor, doc.currency)}</Row>
            ) : null}
            {doc.refundedMinor !== '0' ? (
              <Row label="Refunded">{money(doc.refundedMinor, doc.currency)}</Row>
            ) : null}
            {doc.cardTargetMinor ? (
              <Row label="Charged to card">{money(doc.cardTargetMinor, doc.currency)}</Row>
            ) : null}
            <Row label="Opened">{dateTime(doc.createdAt)}</Row>
            {doc.authorizedAt ? <Row label="Authorized">{dateTime(doc.authorizedAt)}</Row> : null}
            {doc.capturedAt ? <Row label="Captured at">{dateTime(doc.capturedAt)}</Row> : null}
            {doc.expiresAt ? (
              <Row label="Expires">
                {dateTime(doc.expiresAt)}
                {doc.status === 'authorized' ? ' — Razorpay returns any unused money then' : ''}
              </Row>
            ) : null}
          </CardContent>
        </Card>

        {canAct ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => retryStart.mutate()}
              disabled={retryStart.isPending}
            >
              {retryStart.isPending ? 'Asking the charger…' : 'Retry start'}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel hold'}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
