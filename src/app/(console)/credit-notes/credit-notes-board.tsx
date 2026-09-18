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
import type { CreditNote, Page } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';

/**
 * Credit notes, newest first.
 *
 * `repriced` and `unpriced` are issued by the system when a session's price
 * changes after its receipt; `operator` is one somebody issued by hand from
 * the receipt.
 */
export function CreditNotesBoard() {
  const transactionId = useSearchParams().get('transactionId') ?? undefined;

  const notes = useInfiniteQuery({
    queryKey: ['credit-notes', transactionId ?? 'all'],
    queryFn: ({ pageParam }) =>
      apiGet<Page<CreditNote>>('/credit-notes', {
        transactionId,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = notes.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Credit notes"
        description="Every correction to a receipt. The receipt itself is never changed."
      >
        <Button
          variant="outline"
          render={<Link href="/receipts" />}
          nativeButton={false}
        >
          Receipts
        </Button>
      </PageHeader>

      {transactionId ? (
        <p className="text-muted-foreground mb-4 text-sm">
          Showing one session’s credit notes.{' '}
          <Link href="/credit-notes" className="underline">
            Show all
          </Link>
        </p>
      ) : null}

      {notes.isPending ? <Loading /> : null}
      {notes.isError ? <Failed error={notes.error} /> : null}
      {notes.isSuccess && rows.length === 0 ? (
        <Empty>Nothing has been credited.</Empty>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell>
                      <Link
                        href={`/credit-notes/${note.id}`}
                        className="font-medium hover:underline"
                      >
                        {note.documentNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {dateTime(note.issuedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/receipts/${note.receiptId}`}
                        className="hover:underline"
                      >
                        {note.receiptDocumentNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{note.reason}</TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                      {note.note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(note.netMinor, note.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(note.taxMinor, note.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(note.grossMinor, note.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {notes.hasNextPage ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void notes.fetchNextPage()}
              disabled={notes.isFetchingNextPage}
            >
              {notes.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
