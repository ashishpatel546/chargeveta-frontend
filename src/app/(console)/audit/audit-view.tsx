'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ALL, describeDetails, FilterSelect } from '@/components/audit-log';
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
import {
  TENANT_AUDIT_ACTIONS,
  TENANT_AUDIT_TARGET_TYPES,
  type ApiKey,
  type ConsoleUser,
  type TenantAuditEntry,
  type TenantAuditPage,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';

const ACTION_LABELS: Record<string, string> = {
  'staff.sign-in': 'Signed in',
  'staff.sign-in-failed': 'Sign-in refused',
  'fleet-manager.sign-in-failed': 'Fleet manager sign-in refused',
  'driver.sign-in-failed': 'Driver sign-in refused',
  'driver.test-number-code': 'Test phone number asked for a code',
  'driver.test-number-sign-in': 'Driver signed in with a test phone number',
  'staff.setup-redeemed': 'Set password from link',
  'staff.password-reset-requested': 'Asked for a password reset',
  'staff.password-change': 'Changed own password',
  'user.add': 'Person added',
  'user.role-change': 'Role changed',
  'user.deactivate': 'Person deactivated',
  'user.reactivate': 'Person reactivated',
  'user.reset-link': 'Password reset link issued',
  'user.sessions-revoke': 'Signed out everywhere',
  'api-key.create': 'API key created',
  'api-key.revoke': 'API key revoked',
  'card.create': 'Card added',
  'card.update': 'Card changed',
  'card.delete': 'Card deleted',
  'driver.deactivate': 'Driver deactivated',
  'driver.reactivate': 'Driver reactivated',
  'fleet-manager.add': 'Fleet manager added',
  'fleet-manager.deactivate': 'Fleet manager deactivated',
  'fleet-manager.reactivate': 'Fleet manager reactivated',
  'fleet-manager.reset-link': 'Fleet manager link issued',
  'station.credential-set': 'Charger password set',
  'station.client-certificate-set': 'Charger certificate pinned',
  'station.client-certificate-remove': 'Charger certificate unpinned',
  'free-charging.grant': 'Free charging granted',
  'free-charging.revoke': 'Free charging revoked',
  'free-charging.sponsor': 'Free charging made company-paid',
  'free-charging.unsponsor': 'Free charging back to grantor',
  'payment.retry': 'Payment retried',
  'wallet.adjust': 'Wallet adjusted',
  'receipt.credit-note': 'Receipt credited',
  'settings.update': 'Settings changed',
  'tariff.create': 'Tariff created',
  'tariff.rename': 'Tariff renamed',
  'tariff.version-add': 'Tariff prices changed',
  'tariff.assign': 'Tariff assigned',
  'fleet.create': 'Fleet created',
  'fleet.update': 'Fleet changed',
  'fleet.member-add': 'Driver added to fleet',
  'fleet.member-remove': 'Driver removed from fleet',
  'station.reset': 'Charger reset',
  'station.unlock-connector': 'Connector unlocked',
  'station.remote-start': 'Session started remotely',
  'station.remote-stop': 'Session stopped remotely',
  'station.create': 'Charger added',
  'station.update': 'Charger changed',
  'station.delete': 'Charger deleted',
  'station.quarantine': 'Charger quarantined',
  'station.quarantine-clear': 'Quarantine lifted',
  'evse.create': 'EVSE added',
  'connector.create': 'Connector added',
  'connector.update': 'Connector changed',
  'location.create': 'Site added',
  'location.update': 'Site changed',
  'location.delete': 'Site deleted',
  'location.load-management': 'Site load management changed',
  'webhook.create': 'Webhook added',
  'webhook.update': 'Webhook changed',
  'webhook.delete': 'Webhook deleted',
  'webhook.secret-rotate': 'Webhook secret rotated',
  'station.trigger-message': 'Charger asked to report',
  'station.change-availability': 'Availability changed',
  'station.get-configuration': 'Configuration read',
  'station.change-configuration': 'Configuration changed',
  'station.clear-cache': 'Charger cache cleared',
  'station.update-firmware': 'Firmware update sent',
  'station.get-diagnostics': 'Diagnostics requested',
  'station.local-list-send': 'Local card list sent',
  'station.get-local-list-version': 'Local list version read',
  'station.charging-profile-set': 'Charging limit set',
  'station.charging-profile-clear': 'Charging limit cleared',
  'station.get-composite-schedule': 'Charging schedule read',
  'station.certificate-install': 'Certificate installed',
  'station.get-installed-certificates': 'Certificates listed',
  'station.certificate-delete': 'Certificate deleted',
  'station.certificate-signed': 'Signed certificate sent',
  'station.monitor-set': 'Monitor set',
  'station.monitor-clear': 'Monitor cleared',
  'station.get-monitoring-report': 'Monitors listed',
  'station.monitoring-base-set': 'Monitoring base set',
  'station.monitoring-level-set': 'Monitoring level set',
  'station.tariff-send': 'Tariff sent to charger',
  'station.get-tariffs': 'Charger tariffs read',
  'station.tariffs-clear': 'Charger tariffs cleared',
  'reservation.create': 'Connector reserved',
  'reservation.cancel': 'Reservation cancelled',
};

const TARGET_LABELS: Record<string, string> = {
  user: 'Person',
  'api-key': 'API key',
  'id-token': 'Card',
  driver: 'Driver',
  fleet: 'Fleet',
  'fleet-manager': 'Fleet manager',
  payment: 'Payment',
  receipt: 'Receipt',
  tariff: 'Tariff',
  tenant: 'Settings',
  station: 'Charger',
  location: 'Site',
  transaction: 'Session',
  evse: 'EVSE',
  connector: 'Connector',
  webhook: 'Webhook',
};

/** `<input type="date">`'s day, as the instant it starts where the browser is. */
function startOfDay(day: string): string | undefined {
  if (!day) return undefined;
  const at = new Date(`${day}T00:00:00`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

/** The instant after a day ends, for an inclusive "to" day. */
function endOfDay(day: string): string | undefined {
  const start = startOfDay(day);
  if (!start) return undefined;
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

/**
 * What this tenant's staff did that granted money or access, or changed what
 * drivers pay (charveta doc 6 §18.4), newest first — and every sign-in,
 * refused ones too. Admins only, like People and API keys; the API is what
 * refuses anyone else, this only keeps the page from asking.
 */
export function TenantAuditView() {
  const canAdmin = useCan('admin');
  const [action, setAction] = useState<string>(ALL);
  const [actorId, setActorId] = useState<string>(ALL);
  const [targetType, setTargetType] = useState<string>(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // For the "who" filter's labels only; the log keeps each actor's email as
  // it was when they acted.
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<ConsoleUser[]>('/users'),
    enabled: canAdmin,
  });
  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiGet<ApiKey[]>('/api-keys'),
    enabled: canAdmin,
  });

  const filters = { action, actorId, targetType, from, to };
  const log = useInfiniteQuery({
    queryKey: ['audit', filters],
    queryFn: ({ pageParam }) =>
      apiGet<TenantAuditPage>('/audit', {
        action: action !== ALL ? action : undefined,
        actorId: actorId !== ALL ? actorId : undefined,
        targetType: targetType !== ALL ? targetType : undefined,
        from: startOfDay(from),
        to: endOfDay(to),
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: canAdmin,
  });
  const rows = log.data?.pages.flatMap((page) => page.items) ?? [];

  if (!canAdmin) {
    return (
      <>
        <PageHeader title="Audit log" />
        <Empty>The audit log is for admins and owners.</Empty>
      </>
    );
  }

  const actionItems = [
    { value: ALL, label: 'All actions' },
    ...TENANT_AUDIT_ACTIONS.map((value) => ({
      value,
      label: ACTION_LABELS[value] ?? value,
    })),
  ];
  const actorItems = [
    { value: ALL, label: 'Anyone' },
    ...(users.data ?? []).map((user) => ({ value: user.id, label: user.email })),
    ...(keys.data ?? []).map((key) => ({
      value: key.id,
      label: `API key: ${key.name}`,
    })),
  ];
  const targetItems = [
    { value: ALL, label: 'About anything' },
    ...TENANT_AUDIT_TARGET_TYPES.map((value) => ({
      value,
      label: TARGET_LABELS[value] ?? value,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who granted money or access, or changed what drivers pay, and every sign-in — newest first. Entries are never changed or removed."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect value={action} onChange={setAction} items={actionItems} label="Action" />
        <FilterSelect value={actorId} onChange={setActorId} items={actorItems} label="Who" />
        <FilterSelect
          value={targetType}
          onChange={setTargetType}
          items={targetItems}
          label="About"
        />
        <Input
          type="date"
          className="w-40"
          aria-label="From"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Input
          type="date"
          className="w-40"
          aria-label="To"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

      {log.isPending ? <Loading /> : null}
      {log.isError ? <Failed error={log.error} /> : null}
      {log.isSuccess && rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : null}

      {rows.length > 0 ? (
        <>
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateTime(row.occurredAt)}
                    </TableCell>
                    <TableCell className="text-sm">{who(row)}</TableCell>
                    <TableCell className="text-sm">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.targetType ? (TARGET_LABELS[row.targetType] ?? row.targetType) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-80 text-xs whitespace-normal">
                      {describeDetails(row.details)}
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs"
                      title={row.userAgent ?? undefined}
                    >
                      {row.ipAddress ?? '—'}
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

function who(row: TenantAuditEntry): string {
  if (row.actorKind === 'anonymous') {
    return row.actorEmail ? `Someone as ${row.actorEmail}` : 'Someone';
  }
  if (row.actorKind === 'api-key') return `API key: ${row.actorName ?? row.actor}`;
  return row.actorEmail ?? row.actor;
}
