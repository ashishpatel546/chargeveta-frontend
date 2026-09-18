'use client';

import { useQuery } from '@tanstack/react-query';
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
import type { IdToken } from '@/lib/api/types';
import { date } from '@/lib/format';
import { AddCardDialog } from './add-card-dialog';
import { CardStatusBadge } from './badges';
import { BlockCardDialog, DeleteCardDialog, UnblockCardButton } from './card-actions';

/** What the API returns at most, after which the list is silently truncated. */
const LIST_CAP = 500;

export function CardsBoard() {
  const [filter, setFilter] = useState('');
  const canAdmin = useCan('admin');

  const cards = useQuery({
    queryKey: ['cards'],
    queryFn: () => apiGet<IdToken[]>('/id-tokens'),
  });

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = cards.data ?? [];
    if (!needle) return all;
    return all.filter((card) =>
      [card.token, card.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [filter, cards.data]);

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
          {cards.data.length === 0
            ? 'No cards yet. A card added here is what a charger is answered from the next time it is presented.'
            : 'No card matches that.'}
        </Empty>
      ) : null}

      {cards.isSuccess && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
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
                    <TableCell>
                      <CardStatusBadge status={card.status} />
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

          {cards.data.length >= LIST_CAP ? (
            <p className="text-muted-foreground text-xs">
              The API returns the {LIST_CAP} most recently added cards and does
              not page, so older ones are not on this list. The filter above
              searches only what was returned.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
