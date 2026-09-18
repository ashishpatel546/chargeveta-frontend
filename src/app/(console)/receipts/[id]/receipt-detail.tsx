'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api/client';
import type { Receipt } from '@/lib/api/types';
import { dateTime, money, percent } from '@/lib/format';
import { CreditNoteDialog } from './credit-note-dialog';

/**
 * A priced line as the receipt froze it.
 *
 * Declared here because the API types it as `unknown[]`: the pricing engine
 * owns the shape, and a receipt keeps whatever shape it had on the day, so a
 * line that does not match is shown as JSON rather than mis-read.
 */
interface ReceiptLine {
  component: string;
  description: string;
  quantity: string;
  unit: string;
  unitPriceMinor: string;
  amountMinor: number | string;
}

function isLine(value: unknown): value is ReceiptLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.description === 'string' &&
    typeof line.quantity === 'string' &&
    typeof line.unit === 'string' &&
    typeof line.unitPriceMinor === 'string' &&
    (typeof line.amountMinor === 'number' ||
      typeof line.amountMinor === 'string')
  );
}

export function ReceiptDetail({ id }: { id: string }) {
  const canAdmin = useCan('admin');

  const receipt = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => apiGet<Receipt>(`/receipts/${id}`),
  });

  if (receipt.isPending) return <Loading />;
  if (receipt.isError) return <Failed error={receipt.error} />;

  const doc = receipt.data;
  const credited = doc.creditNotes ?? [];
  const settled = doc.remainingNetMinor === '0';

  return (
    <>
      <PageHeader
        title={doc.documentNumber}
        description={`Issued ${dateTime(doc.issuedAt)} by ${doc.issuedBy} · revision ${doc.costRevision} of the session’s cost`}
      >
        <Button
          variant="outline"
          render={<Link href={`/sessions/${doc.transactionId}`} />}
          nativeButton={false}
        >
          Session
        </Button>
        {canAdmin && !settled ? <CreditNoteDialog receipt={doc} /> : null}
      </PageHeader>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Amounts</CardTitle>
            <div className="flex gap-1">
              <Badge variant="outline">{doc.taxTreatment}</Badge>
              <Badge variant="outline">
                {percent(doc.taxRateBp / 10000)} GST
              </Badge>
              {settled ? <Badge variant="secondary">credited in full</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Net" value={money(doc.netMinor, doc.currency)} />
              <Row label="Tax" value={money(doc.taxMinor, doc.currency)} />
              <Row label="Gross" value={money(doc.grossMinor, doc.currency)} />
              <Row
                label="Credited"
                value={money(doc.creditedNetMinor, doc.currency)}
              />
              <Row
                label="Remaining"
                value={money(doc.remainingNetMinor, doc.currency)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {doc.taxLines.length === 0 ? (
              <p className="text-muted-foreground px-4 text-sm">No tax.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.taxLines.map((line) => (
                    <TableRow key={line.component}>
                      <TableCell className="text-sm">
                        {line.component}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {line.ratePercent}%
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {money(line.amountMinor, doc.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What was billed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-0">
            {doc.lines.length === 0 ? (
              <p className="text-muted-foreground px-4 text-sm">No lines.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.lines.map((line, index) =>
                    isLine(line) ? (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {line.description}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {line.quantity} {line.unit}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {money(line.unitPriceMinor, doc.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {money(String(line.amountMinor), doc.currency)}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={index}>
                        <TableCell colSpan={4}>
                          <pre className="overflow-x-auto text-xs">
                            {JSON.stringify(line, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit notes</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {credited.length === 0 ? (
              <p className="text-muted-foreground px-4 text-sm">
                None. A correction to this receipt would appear here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credited.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <Link
                          href={`/credit-notes/${note.id}`}
                          className="font-medium hover:underline"
                        >
                          {note.documentNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {dateTime(note.issuedAt)}
                      </TableCell>
                      <TableCell className="text-sm">{note.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {note.note ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {money(note.netMinor, note.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {money(note.grossMinor, note.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Snapshot as issued
          </summary>
          <div className="space-y-2 p-3">
            <p className="text-muted-foreground text-xs">
              The frozen copy of the supplier, site, charger, card, session
              times, meter registers and tariff version this receipt was billed
              from. It does not follow later changes to any of them.
            </p>
            <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 text-xs">
              {JSON.stringify(doc.snapshot, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
