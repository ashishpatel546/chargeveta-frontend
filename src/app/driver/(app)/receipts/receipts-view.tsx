'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { HistorySwitch } from '../sessions/history-switch';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type { Page, Receipt } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';

/**
 * Doc 6 §22.3: `DriverController.receipts()` reuses `ReceiptsApiService`
 * restricted to the driver's own — the same `Receipt` shape as the staff
 * console's, from `lib/api/types.ts`.
 */
export function ReceiptsView() {
  const receipts = useInfiniteQuery({
    queryKey: ['driver', 'receipts'],
    queryFn: ({ pageParam }) =>
      driverApiGet<Page<Receipt>>('/driver/receipts', { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = receipts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader title="History" />
      <HistorySwitch />

      {receipts.isPending ? <Loading rows={3} /> : null}
      {receipts.isError ? <Failed error={receipts.error} /> : null}
      {receipts.isSuccess && rows.length === 0 ? (
        <Empty>
          No receipts yet. One is issued when a session of yours is priced.
        </Empty>
      ) : null}

      <div className="space-y-3">
        {rows.map((receipt) => (
          <Link key={receipt.id} href={`/driver/receipts/${receipt.id}`}>
            <Card size="sm">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{receipt.documentNumber}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {dateTime(receipt.issuedAt)}
                  </p>
                </div>
                <span className="shrink-0 font-medium">
                  {money(receipt.grossMinor, receipt.currency)}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {receipts.hasNextPage ? (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void receipts.fetchNextPage()}
          disabled={receipts.isFetchingNextPage}
        >
          {receipts.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}
