'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { DownloadIcon, MailIcon, PrinterIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  billingModeLabel,
  type FleetStatement,
  type StatementAmounts,
  type StatementParty,
} from '@/lib/api/fleet-types';
import { date, dateTime, energy, money } from '@/lib/format';

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthName(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(year, index - 1, 1),
  );
}

/**
 * A fleet's monthly statement (`charveta` doc 6 §23 "Statement"), as a page
 * that prints cleanly — "Save as PDF" in the print dialog is the PDF.
 *
 * **Not a tax invoice.** The tax documents are the receipts and credit notes
 * already issued per session, listed against each one; this adds them up with
 * the price before tax, each GST component and the total always shown apart.
 * Every figure comes from the API as it summed the documents; nothing is
 * added up here.
 */
export function StatementView({
  queryKey,
  fetchStatement,
  csvHref,
  sendStatement,
}: {
  queryKey: readonly unknown[];
  fetchStatement: (month: string) => Promise<FleetStatement>;
  /** Where the CSV download is, through this surface's own proxy. */
  csvHref: (month: string) => string;
  /** Staff only: email the month's statement to the fleet now. */
  sendStatement?: (
    month: string,
  ) => Promise<{ recipients: string[]; emailEnabled: boolean }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('month');
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth();

  const statement = useQuery({
    queryKey: [...queryKey, month],
    queryFn: () => fetchStatement(month),
  });

  const send = useMutation({
    mutationFn: () => sendStatement!(month),
    onSuccess: ({ recipients, emailEnabled }) => {
      if (recipients.length === 0) {
        toast.info(
          'Nothing was sent: the month has no settled session, or the fleet has no billing email or active manager.',
        );
      } else if (!emailEnabled) {
        toast.warning(
          `Queued for ${recipients.join(', ')}, but this installation does not send email.`,
        );
      } else {
        toast.success(`Sent to ${recipients.join(', ')}.`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <label htmlFor="statement-month" className="text-xs font-medium">
            Month
          </label>
          <Input
            id="statement-month"
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) {
                router.replace(`?month=${event.target.value}`);
              }
            }}
            className="w-44"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={csvHref(month)} download />}
          >
            <DownloadIcon className="size-4" />
            Download CSV
          </Button>
          {sendStatement ? (
            <Button
              variant="outline"
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              <MailIcon className="size-4" />
              {send.isPending ? 'Sending…' : 'Email to the fleet'}
            </Button>
          ) : null}
          <Button onClick={() => window.print()}>
            <PrinterIcon className="size-4" />
            Print or save as PDF
          </Button>
        </div>
      </div>

      {statement.isPending ? <Loading /> : null}
      {statement.isError ? <Failed error={statement.error} /> : null}
      {statement.isSuccess ? <StatementDocument statement={statement.data} /> : null}
    </div>
  );
}

function StatementDocument({ statement }: { statement: FleetStatement }) {
  const hasIgst = statement.sessions.some((s) => s.igstMinor !== '0');
  const hasCgst = statement.sessions.some((s) => s.cgstMinor !== '0') || !hasIgst;

  return (
    <article className="space-y-8 rounded-md border p-6 print:border-0 print:p-0">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Statement for {monthName(statement.month)}
        </h1>
        <p className="border-l-2 border-caution pl-3 text-sm">
          <strong>This is a statement, not a tax invoice.</strong> The tax
          documents are the receipts (R-) and credit notes (CN-) listed against
          each session, issued when it was charged. Amounts show the price
          before tax, the GST on it, and the total, separately.
        </p>
        <p className="text-muted-foreground text-xs">
          Generated {dateTime(statement.generatedAt)}. Sessions are counted in
          the month they began, in their site&apos;s local time.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <Party title="From (supplier)" party={statement.operator} />
        <Party title="To (fleet)" party={statement.fleet} />
      </div>

      <p className="text-sm">
        <span className="text-muted-foreground">Who pays: </span>
        {billingModeLabel(statement.billingMode, statement.invoiceCollectsAtSession)}
        <span className="text-muted-foreground">
          {' '}
          (as it stands now; each session below says who paid for it, which
          was fixed when it was settled)
        </span>
      </p>

      {statement.sessions.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No settled sessions in this month.
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Sessions</h2>
            <div className="overflow-x-auto rounded-md border print:overflow-visible">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Energy</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">GST rate</TableHead>
                    <TableHead className="text-right">Price before tax</TableHead>
                    {hasCgst ? <TableHead className="text-right">CGST</TableHead> : null}
                    {hasCgst ? <TableHead className="text-right">SGST</TableHead> : null}
                    {hasIgst ? <TableHead className="text-right">IGST</TableHead> : null}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.sessions.map((s) => (
                    <TableRow key={s.transactionId}>
                      <TableCell>{date(s.startedAt)}</TableCell>
                      <TableCell>{s.driverName ?? '—'}</TableCell>
                      <TableCell>{s.siteName ?? s.stationIdentity}</TableCell>
                      <TableCell className="text-right">
                        {s.energyWh ? energy(s.energyWh) : '—'}
                      </TableCell>
                      <TableCell className="font-mono whitespace-normal">
                        {s.documents.join(', ')}
                      </TableCell>
                      <TableCell>{s.paidBy === 'fleet' ? 'Fleet' : 'Driver'}</TableCell>
                      <TableCell className="text-right">{s.taxRatePercent}%</TableCell>
                      <TableCell className="text-right">
                        {money(s.netMinor, s.currency)}
                      </TableCell>
                      {hasCgst ? (
                        <TableCell className="text-right">
                          {money(s.cgstMinor, s.currency)}
                        </TableCell>
                      ) : null}
                      {hasCgst ? (
                        <TableCell className="text-right">
                          {money(s.sgstMinor, s.currency)}
                        </TableCell>
                      ) : null}
                      {hasIgst ? (
                        <TableCell className="text-right">
                          {money(s.igstMinor, s.currency)}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right font-medium">
                        {money(s.grossMinor, s.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">GST summary by rate</h2>
            <div className="bg-card overflow-x-auto rounded-xl border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>GST rate</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Taxable value</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.byRate.map((line) => (
                    <TableRow key={`${line.currency}-${line.taxRatePercent}`}>
                      <TableCell>
                        {line.taxRatePercent}%
                        {statement.totals.length > 1 ? ` (${line.currency})` : ''}
                      </TableCell>
                      <TableCell className="text-right">{line.sessions}</TableCell>
                      <AmountCells amounts={line} currency={line.currency} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Totals for the month</h2>
            {statement.totals.map((total) => (
              <div key={total.currency} className="bg-card overflow-x-auto rounded-xl border">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Price before tax</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Already paid by drivers at the session</TableCell>
                      <TableCell />
                      <AmountCells amounts={total.paidByDrivers} currency={total.currency} />
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Owed by the fleet</TableCell>
                      <TableCell />
                      <AmountCells
                        amounts={total.owedByFleet}
                        currency={total.currency}
                        strong
                      />
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>All sessions</TableCell>
                      <TableCell className="text-right">{total.sessions}</TableCell>
                      <AmountCells amounts={total.all} currency={total.currency} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ))}
          </section>
        </>
      )}
    </article>
  );
}

function AmountCells({
  amounts,
  currency,
  strong = false,
}: {
  amounts: StatementAmounts;
  currency: string;
  strong?: boolean;
}) {
  return (
    <>
      <TableCell className="text-right">{money(amounts.netMinor, currency)}</TableCell>
      <TableCell className="text-right">{money(amounts.cgstMinor, currency)}</TableCell>
      <TableCell className="text-right">{money(amounts.sgstMinor, currency)}</TableCell>
      <TableCell className="text-right">{money(amounts.igstMinor, currency)}</TableCell>
      <TableCell className="text-right">{money(amounts.taxMinor, currency)}</TableCell>
      <TableCell className={strong ? 'text-right font-semibold' : 'text-right'}>
        {money(amounts.grossMinor, currency)}
      </TableCell>
    </>
  );
}

function Party({ title, party }: { title: string; party: StatementParty }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted-foreground text-xs font-medium uppercase">{title}</p>
      <p className="font-medium">{party.name ?? '—'}</p>
      {party.gstin ? <p>GSTIN {party.gstin}</p> : <p className="text-muted-foreground">No GSTIN on file</p>}
      {party.address ? <p className="whitespace-pre-line">{party.address}</p> : null}
      {party.email ? <p>{party.email}</p> : null}
    </div>
  );
}
