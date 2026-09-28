'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Failed, Loading } from '@/components/query-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FleetBillingMonth } from '@/lib/api/fleet-types';
import { money } from '@/lib/format';

/** This month, as `<input type="month">` writes it. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A fleet's billed sessions in one month (`charveta` doc 6 §23 "Billing"):
 * what members paid at the session and what the fleet owes, per currency.
 * The API counts each session in its site's own month.
 */
export function BillingMonthCard({
  queryKey,
  fetchMonth,
  owedLabel = 'Owed by the fleet',
  statementHref,
}: {
  queryKey: readonly unknown[];
  fetchMonth: (month: string) => Promise<FleetBillingMonth>;
  owedLabel?: string;
  /** The month's statement page, with the tax on every session shown apart. */
  statementHref?: (month: string) => string;
}) {
  const [month, setMonth] = useState(currentMonth);
  const billing = useQuery({
    queryKey: [...queryKey, month],
    queryFn: () => fetchMonth(month),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Settled sessions in the month, in each site&apos;s local time.
          </CardDescription>
        </div>
        <div className="space-y-1">
          <Label htmlFor="billing-month" className="text-xs">
            Month
          </Label>
          <Input
            id="billing-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-44"
          />
        </div>
      </CardHeader>
      <CardContent>
        {billing.isPending ? <Loading rows={1} /> : null}
        {billing.isError ? <Failed error={billing.error} /> : null}
        {billing.isSuccess && billing.data.lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No settled sessions in this month.
          </p>
        ) : null}
        {billing.isSuccess
          ? billing.data.lines.map((line) => (
              <dl
                key={line.currency}
                className="grid grid-cols-2 gap-4 sm:grid-cols-4"
              >
                <Figure label="Sessions" value={String(line.sessions)} />
                <Figure
                  label="Total"
                  value={money(line.totalMinor, line.currency)}
                />
                <Figure
                  label="Paid by drivers"
                  value={money(line.collectedMinor, line.currency)}
                />
                <Figure
                  label={owedLabel}
                  value={money(line.owedMinor, line.currency)}
                  strong
                />
              </dl>
            ))
          : null}
        {statementHref && billing.isSuccess && billing.data.lines.length > 0 ? (
          <p className="mt-4 text-sm">
            <Link
              href={statementHref(month)}
              className="underline underline-offset-4"
            >
              View the statement, with GST shown for each session
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={strong ? 'text-lg font-semibold' : 'text-lg'}>{value}</dd>
    </div>
  );
}
