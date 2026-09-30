'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Empty, Failed, Loading } from '@/components/query-state';
import { ALL, FilterSelect } from '@/components/audit-log';
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
import { platformApiGet } from '@/lib/api/platform-client';
import { SIGN_IN_SURFACES, type UnknownTenantSignInPage } from '@/lib/api/platform-types';
import { dateTime } from '@/lib/format';

const SURFACE_LABELS: Record<string, string> = {
  staff: 'Staff console',
  'fleet-manager': 'Fleet portal',
  driver: 'Driver app',
};

/**
 * Sign-ins refused because the tenant slug named no tenant (doc 6 §18.4),
 * newest first. They belong to no tenant, so this is the only place they show:
 * a run of guessed slugs, or one address tried across many, is visible here.
 * A refusal inside a real tenant is in that tenant's own audit log instead.
 */
export function UnknownTenantSignIns() {
  const [surface, setSurface] = useState<string>(ALL);
  const [draft, setDraft] = useState({ email: '', ipAddress: '' });
  const [search, setSearch] = useState({ email: '', ipAddress: '' });

  const log = useInfiniteQuery({
    queryKey: ['platform', 'unknown-tenant-sign-ins', surface, search],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams();
      if (surface !== ALL) query.set('surface', surface);
      if (search.email) query.set('email', search.email);
      if (search.ipAddress) query.set('ipAddress', search.ipAddress);
      if (pageParam) query.set('cursor', pageParam);
      const qs = query.toString();
      return platformApiGet<UnknownTenantSignInPage>(
        `/audit/unknown-tenant-sign-ins${qs ? `?${qs}` : ''}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = log.data?.pages.flatMap((page) => page.items) ?? [];

  const surfaceItems = [
    { value: ALL, label: 'Every sign-in' },
    ...SIGN_IN_SURFACES.map((value) => ({
      value,
      label: SURFACE_LABELS[value] ?? value,
    })),
  ];

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setSearch({ email: draft.email.trim(), ipAddress: draft.ipAddress.trim() });
  };

  return (
    <>
      <p className="text-muted-foreground mb-4 text-sm">
        Sign-ins refused because the tenant asked for does not exist. The password tried is never
        kept. Refusals in a real tenant are in that tenant&apos;s own audit log.
      </p>
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect value={surface} onChange={setSurface} items={surfaceItems} label="Sign-in" />
        <Input
          className="w-60"
          placeholder="Email tried"
          aria-label="Email tried"
          value={draft.email}
          onChange={(event) => setDraft((d) => ({ ...d, email: event.target.value }))}
        />
        <Input
          className="w-44"
          placeholder="From address"
          aria-label="From address"
          value={draft.ipAddress}
          onChange={(event) => setDraft((d) => ({ ...d, ipAddress: event.target.value }))}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {log.isPending ? <Loading /> : null}
      {log.isError ? <Failed error={log.error} /> : null}
      {log.isSuccess && rows.length === 0 ? <Empty>Nothing recorded.</Empty> : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Sign-in</TableHead>
                  <TableHead>Tenant asked for</TableHead>
                  <TableHead>Email tried</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {SURFACE_LABELS[row.surface] ?? row.surface}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.attemptedSlug ?? '—'}</TableCell>
                    <TableCell className="text-sm">{row.attemptedEmail ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ipAddress ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground max-w-72 truncate text-xs">
                      {row.userAgent ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {log.hasNextPage ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void log.fetchNextPage()}
              disabled={log.isFetchingNextPage}
            >
              {log.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
