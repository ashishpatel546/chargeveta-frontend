'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { IdToken, Page } from '@/lib/api/types';
import { date } from '@/lib/format';
import { AddCardDialog } from './add-card-dialog';
import { CardStatusBadge, FreeChargingBadge } from './badges';
import { BlockCardDialog, DeleteCardDialog, UnblockCardButton } from './card-actions';

export function CardsBoard() {
  const [filter, setFilter] = useState('');
  const canAdmin = useCan('admin');

  // Paged newest first (`GET /id-tokens`, doc 6 §15.6); a fleet's card list
  // can be tens of thousands long.
  const cards = useInfiniteQuery({
    queryKey: ['cards'],
    queryFn: ({ pageParam }) =>
      apiGet<Page<IdToken>>('/id-tokens', { limit: '200', cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const loaded = useMemo(
    () => cards.data?.pages.flatMap((page) => page.items) ?? [],
    [cards.data],
  );

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = loaded;
    if (!needle) return all;
    return all.filter((card) =>
      [card.token, card.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [filter, loaded]);

  return (
    <>
      <PageHeader
        title="Cards"
        description="The RFID cards, key codes and contract ids a driver can start a session with."
      >
        <Button
          variant="outline"
          render={<Link href="/cards/reads" />}
          nativeButton={false}
        >
          All card reads
        </Button>
        {canAdmin ? <AddCardDialog /> : null}
      </PageHeader>

      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by token or label"
        className="mb-4 max-w-sm"
        aria-label="Filter cards"
      />

      {cards.isPending ? <Loading /> : null}
      {cards.isError ? <Failed error={cards.error} /> : null}
      {cards.isSuccess && rows.length === 0 ? (
        <Empty>
          {loaded.length === 0
            ? 'No cards yet. A card added here is what a charger is answered from the next time it is presented.'
            : 'No card matches that.'}
        </Empty>
      ) : null}

      {cards.isSuccess && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Added</TableHead>
                  {canAdmin ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Link
                        href={`/cards/${card.id}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {card.token}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {card.label ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {card.tokenType ?? '—'}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      <CardStatusBadge status={card.status} />
                      {card.freeCharging?.active ? (
                        <FreeChargingBadge
                          company={card.freeCharging.companySponsored}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {card.groupId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {card.expiresAt ? date(card.expiresAt) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {date(card.createdAt)}
                    </TableCell>
                    {canAdmin ? (
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {card.isBlocked ? (
                          <UnblockCardButton card={card} />
                        ) : (
                          <BlockCardDialog card={card} />
                        )}
                        <DeleteCardDialog card={card} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {cards.hasNextPage ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => void cards.fetchNextPage()}
                disabled={cards.isFetchingNextPage}
              >
                {cards.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
              <p className="text-muted-foreground text-xs">
                {loaded.length} most recently added shown. The filter above
                searches only what is loaded.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
