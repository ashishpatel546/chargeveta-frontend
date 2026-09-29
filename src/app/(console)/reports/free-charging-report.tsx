'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { FreeChargingReport } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';
import { downloadCsv } from './period';

/** This month, as `<input type="month">` writes it. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A month's free charging, and who owes it (`charveta` doc 6 §22.4, "Card taps
 * and free charging"): per grantor, and what the company took on. Each
 * session counts in its site's own month, as the fleet statement does, and
 * the amounts follow its receipts and credit notes.
 */
export function FreeChargingReportPanel() {
  const [month, setMonth] = useState(currentMonth);
  const valid = /^\d{4}-\d{2}$/.test(month);

  const report = useQuery({
    queryKey: ['report', 'free-charging', month],
    queryFn: () =>
      apiGet<FreeChargingReport>('/free-charging/report', { month }),
    enabled: valid,
  });

  const csv = useMutation({
    mutationFn: () =>
      downloadCsv(
        '/free-charging/report',
        { month },
        `free-charging-${month}.csv`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="free-month" className="text-xs">
            Month
          </Label>
          <Input
            id="free-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-44"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => csv.mutate()}
          disabled={!valid || csv.isPending}
        >
          <DownloadIcon />
          {csv.isPending ? 'Preparing…' : 'CSV'}
        </Button>
      </div>

      {report.isPending && valid ? <Loading /> : null}
      {report.isError ? <Failed error={report.error} /> : null}
      {report.isSuccess && report.data.sessions.length === 0 ? (
        <Empty>No free sessions settled in this month.</Empty>
      ) : null}

      {report.isSuccess && report.data.sessions.length > 0 ? (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid for by</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.totals.map((row) => (
                  <TableRow
                    key={`${row.payerKind}-${row.payer?.userId ?? ''}-${row.currency}`}
                  >
                    <TableCell className="text-sm">
                      {row.payerKind === 'company'
                        ? 'The company'
                        : (row.payer?.email ?? 'A former user')}
                    </TableCell>
                    <TableCell className="text-sm">{row.currency}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.sessions}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(row.amountMinor, row.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Charger</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Paid for by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.sessions.map((row) => (
                  <TableRow key={row.transactionId}>
                    <TableCell className="text-sm whitespace-nowrap">
                      <Link
                        href={`/sessions/${row.transactionId}`}
                        className="hover:underline"
                      >
                        {dateTime(row.startedAt)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.stationIdentity}
                      {row.siteName ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {row.siteName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.card}
                      {row.cardLabel ? (
                        <span className="text-muted-foreground font-sans">
                          {' '}
                          · {row.cardLabel}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{row.reason}</TableCell>
                    <TableCell className="text-sm">
                      {row.payerKind === 'company'
                        ? 'The company'
                        : (row.payer?.email ?? 'A former user')}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(row.amountMinor, row.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            Who pays for a session is fixed when it is first settled: an owner
            making the company pay moves later sessions, not these.
          </p>
        </div>
      ) : null}
    </>
  );
}
