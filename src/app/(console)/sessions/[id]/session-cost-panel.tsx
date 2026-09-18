'use client';

import { useQuery } from '@tanstack/react-query';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, apiGet } from '@/lib/api/client';
import type { TransactionCost } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';

export function SessionCostPanel({ id }: { id: string }) {
  const cost = useQuery({
    queryKey: ['transactions', id, 'cost'],
    queryFn: async (): Promise<TransactionCost | null> => {
      try {
        return await apiGet<TransactionCost>(`/transactions/${id}/cost`);
      } catch (error) {
        // The API has no cost row until the worker has priced the session, and
        // says so with a 404. That is a stage of a session, not a failure.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cost.isPending ? <Loading rows={2} /> : null}
        {cost.isError ? <Failed error={cost.error} /> : null}
        {cost.isSuccess && cost.data === null ? (
          <Empty>
            Not priced yet. A session is priced after it stops, once the worker
            has its last reading.
          </Empty>
        ) : null}
        {cost.isSuccess && cost.data ? <CostBody cost={cost.data} /> : null}
      </CardContent>
    </Card>
  );
}

function CostBody({ cost }: { cost: TransactionCost }) {
  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Total">
          {cost.status === 'priced' ? (
            <span className="text-base font-medium">
              {money(cost.totalMinor, cost.currency)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              not priced — {cost.unpricedReason ?? 'no reason given'}
            </span>
          )}
        </Field>
        <Field label="Currency">{cost.currency ?? '—'}</Field>
        <Field label="Clock">
          <span className="flex items-center gap-2">
            {cost.clockSource === 'station' ? 'the charger’s' : 'ours'}
            {cost.clockTrusted ? (
              <Badge variant="outline">trusted</Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500"
              >
                not trusted
              </Badge>
            )}
          </span>
        </Field>
        <Field label="Revision">{cost.revision}</Field>
        <Field label="Billed from">{dateTime(cost.billedStartedAt)}</Field>
        <Field label="Billed to">{dateTime(cost.billedStoppedAt)}</Field>
      </dl>

      {cost.unpricedDetail ? (
        <p className="text-muted-foreground text-sm">{cost.unpricedDetail}</p>
      ) : null}

      <CostLines lines={cost.lines} />
    </>
  );
}

/**
 * The priced lines, whatever they turn out to be.
 *
 * The API types `lines` as `unknown[]` and its shape belongs to the tariff that
 * priced the session, so this renders the keys it finds rather than the keys it
 * expects — a line with a field this console has never seen still shows it.
 */
function CostLines({ lines }: { lines: unknown[] }) {
  if (lines.length === 0) {
    return <p className="text-muted-foreground text-sm">No lines.</p>;
  }

  const rows = lines.filter(isPlainObject);
  if (rows.length !== lines.length) {
    return (
      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
        {JSON.stringify(lines, null, 2)}
      </pre>
    );
  }

  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column} className="text-sm">
                  {cell(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
