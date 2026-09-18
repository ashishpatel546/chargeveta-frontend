'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { Page, Receipt } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';

/**
 * Receipts, newest first.
 *
 * A receipt is never edited: a correction is a credit note beside it, which is
 * why the last two columns are what has been credited and what is left rather
 * than a single amount. `remainingNetMinor` comes from the API — the console
 * never subtracts money.
 */
export function ReceiptsBoard() {
  // A session's page links here with its id, so one session's documents can be
  // read without typing a uuid into a filter.
  const transactionId = useSearchParams().get('transactionId') ?? undefined;

  const receipts = useInfiniteQuery({
    queryKey: ['receipts', transactionId ?? 'all'],
    queryFn: ({ pageParam }) =>
      apiGet<Page<Receipt>>('/receipts', {
        transactionId,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = receipts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Numbered in order, one per priced session. A receipt never changes; a correction is a credit note."
      >
        <Button
          variant="outline"
          render={<Link href="/credit-notes" />}
          nativeButton={false}
        >
          Credit notes
        </Button>
      </PageHeader>

      {transactionId ? (
        <p className="text-muted-foreground mb-4 text-sm">
          Showing one session’s receipts.{' '}
          <Link href="/receipts" className="underline">
            Show all
          </Link>
        </p>
      ) : null}

      {receipts.isPending ? <Loading /> : null}
      {receipts.isError ? <Failed error={receipts.error} /> : null}
      {receipts.isSuccess && rows.length === 0 ? (
        <Empty>
          {transactionId
            ? 'No receipt has been issued for that session.'
            : 'No receipts yet. One is issued when a session is priced.'}
        </Empty>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Credited</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="font-medium hover:underline"
                      >
                        {receipt.documentNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {dateTime(receipt.issuedAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(receipt.netMinor, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(receipt.taxMinor, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(receipt.grossMinor, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(receipt.creditedNetMinor, receipt.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(receipt.remainingNetMinor, receipt.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {receipts.hasNextPage ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void receipts.fetchNextPage()}
              disabled={receipts.isFetchingNextPage}
            >
              {receipts.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
