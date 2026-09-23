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
} from '@/lib/api/driver-types';
import { dateTime, energy, money, span } from '@/lib/format';

/** One of `SessionsView`'s rows, in full — doc 6 §22.3. */
export function SessionDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: ['driver', 'session', id],
    queryFn: () => driverApiGet<DriverSessionDto>(`/driver/sessions/${id}`),
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
