'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
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
import type { CreditNote } from '@/lib/api/types';
import { dateTime, money } from '@/lib/format';

const WHY: Record<CreditNote['reason'], string> = {
  repriced: 'The session was priced again after the receipt was issued.',
  unpriced: 'The session lost its price after the receipt was issued.',
  operator: 'Issued by hand from the receipt.',
};

export function CreditNoteDetail({ id }: { id: string }) {
  const note = useQuery({
    queryKey: ['credit-note', id],
    queryFn: () => apiGet<CreditNote>(`/credit-notes/${id}`),
  });

  if (note.isPending) return <Loading />;
  if (note.isError) return <Failed error={note.error} />;

  const doc = note.data;

  return (
    <>
      <PageHeader
        title={doc.documentNumber}
        description={`Issued ${dateTime(doc.issuedAt)} by ${doc.issuedBy}`}
      >
        <Button
          variant="outline"
          render={<Link href={`/receipts/${doc.receiptId}`} />}
          nativeButton={false}
        >
          {doc.receiptDocumentNumber}
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Amounts</CardTitle>
            <Badge variant="outline">{doc.reason}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Net" value={money(doc.netMinor, doc.currency)} />
              <Row label="Tax" value={money(doc.taxMinor, doc.currency)} />
              <Row label="Gross" value={money(doc.grossMinor, doc.currency)} />
            </dl>
            <p className="text-muted-foreground text-sm">{WHY[doc.reason]}</p>
            {doc.note ? <p className="text-sm">{doc.note}</p> : null}
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
