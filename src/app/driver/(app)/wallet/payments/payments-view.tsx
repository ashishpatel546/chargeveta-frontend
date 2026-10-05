'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type { PaymentDto, PaymentPage } from '@/lib/api/driver-types';
import { dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';

export const STATUS_TONE: Record<string, string> = {
  created: 'text-muted-foreground',
  authorized:
    'border-primary/20 bg-primary/5 text-primary',
  captured:
    'border-ok/30 bg-ok/10 text-ok-ink',
  released: 'text-muted-foreground',
  refunded: 'text-muted-foreground',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const PURPOSE_LABEL: Record<string, string> = {
  top_up: 'Top-up',
  hold: 'Hold',
};

/** Doc 6 §22.4: every top-up and card hold the driver has opened, newest first. */
export function PaymentsView() {
  const payments = useInfiniteQuery({
    queryKey: ['driver', 'payments'],
    queryFn: ({ pageParam }) =>
      driverApiGet<PaymentPage>('/driver/payments', { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = payments.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="Payments" description="Top-ups and card holds." />

      {payments.isPending ? <Loading rows={3} /> : null}
      {payments.isError ? <Failed error={payments.error} /> : null}
      {payments.isSuccess && rows.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : null}

      <div className="space-y-3">
        {rows.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </div>

      {payments.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void payments.fetchNextPage()}
          disabled={payments.isFetchingNextPage}
        >
          {payments.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}

function PaymentRow({ payment }: { payment: PaymentDto }) {
  return (
    <Link href={`/driver/wallet/payments/${payment.id}`}>
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {PURPOSE_LABEL[payment.purpose] ?? payment.purpose}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {dateTime(payment.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant="outline"
              className={cn('font-medium', STATUS_TONE[payment.status])}
            >
              {payment.status}
            </Badge>
            <span className="text-sm font-medium">
              {money(payment.amountMinor, payment.currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
