'use client';

import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import Link from 'next/link';
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
import type { AuthorizationRecord, Page } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { DecisionBadge } from './badges';

/**
 * Card decisions: the same list and the same paging whether it is one card's
 * history or the whole tenant's feed, so the two screens cannot drift apart.
 */

export interface AuthorizationFilters {
  /** Omitted for every card; `''` is a filter of its own — see below. */
  token?: string;
  stationId?: string;
  /** Comma-separated, as the API takes it. */
  status?: string;
}

/**
 * The status filters worth offering, including the two compound ones an
 * operator actually asks for. `undecided` is not a refusal: it means the engine
 * could not reach the platform, so the charger got a protocol error rather than
 * an answer.
 */
export const DECISION_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any result' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Blocked,Expired,Unknown', label: 'Turned away' },
  { value: 'Blocked', label: 'Blocked' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Unknown', label: 'Unknown card' },
  { value: 'undecided', label: 'No decision reached' },
];

/**
 * The query string is assembled here rather than handed to `apiGet`'s params,
 * which drop empty values. On this endpoint an empty `token=` is a question in
 * its own right — the reads where the charger could not identify a card at all
 * — so it has to survive as far as the API.
 */
function withQuery(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export type AuthorizationsQuery = UseInfiniteQueryResult<
  InfiniteData<Page<AuthorizationRecord>>,
  Error
>;

/** `path` is `/authorizations` or one card's `/id-tokens/:id/authorizations`. */
export function useAuthorizations(
  path: string,
  filters: AuthorizationFilters,
): AuthorizationsQuery {
  return useInfiniteQuery({
    queryKey: ['authorizations', path, filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiGet<Page<AuthorizationRecord>>(
        withQuery(path, { ...filters, cursor: pageParam }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function AuthorizationTable({
  query,
  showCard = false,
  empty,
}: {
  query: AuthorizationsQuery;
  /** On a single card's history the card column would say the same thing. */
  showCard?: boolean;
  empty: string;
}) {
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <Loading />;
  if (query.isError) return <Failed error={query.error} />;
  if (rows.length === 0) return <Empty>{empty}</Empty>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              {showCard ? <TableHead>Card</TableHead> : null}
              <TableHead>Charger</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {dateTime(record.receivedAt)}
                </TableCell>
                {showCard ? (
                  <TableCell className="font-mono text-xs">
                    {record.token === '' ? (
                      <span className="text-muted-foreground font-sans italic">
                        unreadable
                      </span>
                    ) : (
                      record.token
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="text-sm">
                  <Link
                    href={`/stations/${record.stationId}`}
                    className="hover:underline"
                  >
                    {record.stationIdentity}
                  </Link>
                </TableCell>
                <TableCell>
                  <DecisionBadge status={record.status} />
                </TableCell>
                <TableCell className="text-muted-foreground max-w-md text-sm">
                  {record.failure ?? record.detail ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {query.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  );
}
