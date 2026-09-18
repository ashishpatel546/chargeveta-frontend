'use client';

import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { TransactionEvent } from '@/lib/api/types';
import { dateTime } from '@/lib/format';

/**
 * What the charger said during the session, oldest first.
 *
 * The raw payload is behind a click rather than in a column: it is the thing to
 * read when a bill is disputed, and it is far too wide to sit in a table.
 */
export function SessionEvents({ id }: { id: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ['transactions', id, 'events'],
    queryFn: () => apiGet<TransactionEvent[]>(`/transactions/${id}/events`),
  });

  if (events.isPending) return <Loading rows={4} />;
  if (events.isError) return <Failed error={events.error} />;
  if (events.data.length === 0) {
    return (
      <Empty>
        Nothing yet. Events appear once the consumer has read them off the
        stream.
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Occurred</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Seq</TableHead>
            <TableHead>Charging</TableHead>
            <TableHead>Stop reason</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.data.map((event) => (
            <Fragment key={event.id}>
              <TableRow
                onClick={() =>
                  setExpanded((open) => (open === event.id ? null : event.id))
                }
                className="cursor-pointer"
              >
                <TableCell className="text-sm">
                  {dateTime(event.occurredAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {dateTime(event.receivedAt)}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {event.eventType}
                  {event.offline ? (
                    <Badge variant="outline" className="ml-2">
                      offline
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {event.triggerReason ?? '—'}
                </TableCell>
                <TableCell className="text-sm">{event.seqNo ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  {event.chargingState ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {event.stoppedReason ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {expanded === event.id ? 'hide' : 'payload'}
                </TableCell>
              </TableRow>
              {expanded === event.id ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
