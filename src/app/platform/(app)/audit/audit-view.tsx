'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { ALL, describeDetails, FilterSelect } from '@/components/audit-log';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { platformApiGet } from '@/lib/api/platform-client';
import {
  PLATFORM_AUDIT_ACTIONS,
  type PlatformAdmin,
  type PlatformAuditEntry,
  type PlatformAuditPage,
  type PlatformTenantListItem,
} from '@/lib/api/platform-types';
import { dateTime } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  'tenant.create': 'Tenant created',
  'tenant.update': 'Tenant changed',
  'tenant.suspend': 'Tenant suspended',
  'tenant.reinstate': 'Tenant reinstated',
  'tenant.owner-link': 'Owner link issued',
  'admin.add': 'Admin added',
  'admin.deactivate': 'Admin deactivated',
  'admin.reactivate': 'Admin reactivated',
  'admin.reset-link': 'Admin reset link issued',
  'admin.setup-redeemed': 'Admin set password from link',
  'admin.sign-in': 'Signed in',
  'admin.sign-in-failed': 'Sign-in refused',
  'admin.password-change': 'Changed own password',
  'audit.prune': 'Old audit rows pruned',
  'retention.prune': 'Old command, quarantine and message history pruned',
};

/**
 * Everything done above the tenants (doc 6 §19.4), newest first: tenants
 * created, changed and suspended, owner links, admins added, deactivated and
 * reset, sign-ins (refused ones too) and password changes. Read-only — the
 * API keeps it append-only — and never holding a token or password.
 */
export function PlatformAuditView() {
  const [action, setAction] = useState<string>(ALL);
  const [tenantId, setTenantId] = useState<string>(ALL);
  const [actorId, setActorId] = useState<string>(ALL);

  // For the filters' labels only; the log itself names tenants as they are now.
  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApiGet<PlatformTenantListItem[]>('/tenants'),
  });
  const admins = useQuery({
    queryKey: ['platform', 'admins'],
    queryFn: () => platformApiGet<PlatformAdmin[]>('/admins'),
  });

  const filters = { action, tenantId, actorId };
  const log = useInfiniteQuery({
    queryKey: ['platform', 'audit', filters],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams();
      if (action !== ALL) query.set('action', action);
      if (tenantId !== ALL) query.set('tenantId', tenantId);
      if (actorId !== ALL) query.set('actorId', actorId);
      if (pageParam) query.set('cursor', pageParam);
      const search = query.toString();
      return platformApiGet<PlatformAuditPage>(`/audit${search ? `?${search}` : ''}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = log.data?.pages.flatMap((page) => page.items) ?? [];

  const actionItems = [
    { value: ALL, label: 'All actions' },
    ...PLATFORM_AUDIT_ACTIONS.map((value) => ({
      value,
      label: ACTION_LABELS[value] ?? value,
    })),
  ];
  const tenantItems = [
    { value: ALL, label: 'All tenants' },
    ...(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];
  const actorItems = [
    { value: ALL, label: 'Anyone' },
    ...(admins.data ?? []).map((a) => ({ value: a.id, label: a.name ?? a.email })),
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="What has been done on this platform and by whom, newest first. Entries are never changed or removed."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect value={action} onChange={setAction} items={actionItems} label="Action" />
        <FilterSelect value={tenantId} onChange={setTenantId} items={tenantItems} label="Tenant" />
        <FilterSelect value={actorId} onChange={setActorId} items={actorItems} label="Admin" />
      </div>

      {log.isPending ? <Loading /> : null}
      {log.isError ? <Failed error={log.error} /> : null}
      {log.isSuccess && rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{who(row)}</TableCell>
                    <TableCell className="text-sm">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.tenantId ? (row.tenantName ?? 'Removed tenant') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-80 text-xs whitespace-normal">
                      {describeDetails(row.detail)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.ipAddress ?? '—'}</TableCell>
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

function who(row: PlatformAuditEntry): string {
  if (row.actor === 'platform') return 'Platform secret (a script)';
  if (row.actor.startsWith('script:')) return `Server script (${row.actor.slice(7)})`;
  if (row.actor.startsWith('system:')) return `The system (${row.actor.slice(7)})`;
  if (row.actor === 'anonymous') return row.actorEmail ? `Someone as ${row.actorEmail}` : 'Someone';
  return row.actorEmail ?? row.actor;
}
