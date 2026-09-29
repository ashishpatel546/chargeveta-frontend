'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type {
  DriverCommandResultDto,
  DriverSessionDto,
  DriverSessionLimitDto,
} from '@/lib/api/driver-types';
import { dateTime, energy, money, power, span } from '@/lib/format';

/** One of `SessionsView`'s rows, in full — doc 6 §22.3. */
export function SessionDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: ['driver', 'session', id],
    queryFn: () => driverApiGet<DriverSessionDto>(`/driver/sessions/${id}`),
    // The running cost moves with every meter reading the charger sends.
    refetchInterval: (query) =>
      query.state.data && !query.state.data.stoppedAt ? 10_000 : false,
  });

  const stop = useMutation({
    mutationFn: () =>
      driverApiSend<DriverCommandResultDto>(
        'POST',
        `/driver/sessions/${id}/stop`,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ['driver', 'session', id],
      });
      void queryClient.invalidateQueries({ queryKey: ['driver', 'sessions'] });
      if (result.outcome === 'answered') {
        toast.success(`Charger answered: ${result.status ?? 'stopped'}.`);
      } else {
        toast.error(
          `The charger did not confirm (${result.outcome.replace(/_/g, ' ')}).`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (session.isPending) return <Loading />;
  if (session.isError) return <Failed error={session.error} />;

  const doc = session.data;
  const running = !doc.stoppedAt;
  const limit = doc.limit;
  const usedUp = limit?.stopRequestedAt ? usedUpText(limit.stopReason) : null;

  return (
    <>
      <PageHeader
        title={doc.siteName ?? doc.stationIdentity}
        description={doc.siteName ? doc.stationIdentity : undefined}
      >
        {running ? (
          <Button onClick={() => stop.mutate()} disabled={stop.isPending}>
            {stop.isPending ? 'Stopping…' : 'Stop charging'}
          </Button>
        ) : null}
      </PageHeader>

      <div className="space-y-4">
        {usedUp ? (
          <div
            role="status"
            className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3 text-sm text-amber-800 dark:text-amber-300"
          >
            {running ? `Stopping: ${usedUp}.` : `Stopped: ${usedUp}.`}
          </div>
        ) : null}

        {limit && running ? <LiveCard limit={limit} /> : null}

        <Card size="sm">
          <CardContent className="space-y-2 text-sm">
            <Row label="Status">
              {running ? (
                <Badge
                  variant="outline"
                  className="border-sky-600/30 bg-sky-600/10 font-medium text-sky-700 dark:text-sky-400"
                >
                  running
                </Badge>
              ) : (
                <span>{doc.stoppedReason ?? 'Stopped'}</span>
              )}
            </Row>
            <Row label="Started">{dateTime(doc.startedAt)}</Row>
            <Row label="Duration">
              {span(doc.startedAt, doc.stoppedAt ?? undefined)}
            </Row>
            <Row label="Energy">{energy(doc.energyWh ?? undefined)}</Row>
            <Row label="Cost">
              {doc.costStatus === 'unpriced' ? (
                <span className="text-muted-foreground">not priced</span>
              ) : doc.costStatus === 'priced' ? (
                money(doc.netMinor ?? undefined, doc.currency ?? undefined)
              ) : (
                '—'
              )}
            </Row>
          </CardContent>
        </Card>

        {doc.receiptId ? (
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/driver/receipts/${doc.receiptId}`} />}
            nativeButton={false}
          >
            View receipt
          </Button>
        ) : null}
      </div>
    </>
  );
}

/** Why the session was stopped for money, in the driver's words. */
function usedUpText(reason: string | null): string {
  return reason === 'hold_used_up'
    ? 'your card hold was used up'
    : 'your wallet balance was used up';
}

/**
 * The session while it runs (doc 6 §22.4 "Session limits"): what it has cost
 * so far, priced as the receipt will be, and what is left before charging is
 * stopped. Every figure is the API's; nothing is computed here.
 */
function LiveCard({ limit }: { limit: DriverSessionLimitDto }) {
  const currency = limit.currency ?? 'INR';
  return (
    <Card size="sm">
      <CardContent className="space-y-2 text-sm">
        <div className="pb-1">
          <p className="text-muted-foreground text-xs">Cost so far, tax included</p>
          <p className="text-2xl font-semibold tabular-nums">
            {money(limit.runningCostMinor, currency)}
          </p>
        </div>
        {limit.source !== 'none' && limit.budgetMinor !== null ? (
          <>
            <Row label={limit.source === 'hold' ? 'Hold and wallet' : 'Wallet'}>
              {money(limit.budgetMinor, currency)}
            </Row>
            <Row label="Left">
              {money(limit.remainingMinor ?? undefined, currency)}
            </Row>
          </>
        ) : null}
        <Row label="Energy">{energy(limit.energyWh ?? undefined)}</Row>
        {limit.powerW !== null ? (
          <Row label="Power">{power(limit.powerW)}</Row>
        ) : null}
        {limit.socPercent !== null ? (
          <Row label="Battery">{`${Number(limit.socPercent).toFixed(0)}%`}</Row>
        ) : null}
        {limit.toFullWh !== null ? (
          <Row label="To full (estimate)">
            {`about ${energy(limit.toFullWh)}`}
            {limit.toFullMinor !== null
              ? `, ${money(limit.toFullMinor, currency)}`
              : ''}
          </Row>
        ) : null}
        {limit.source !== 'none' ? (
          <p className="text-muted-foreground pt-1 text-xs">
            Charging stops by itself a little before the money runs out, so
            your balance never goes below zero.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
