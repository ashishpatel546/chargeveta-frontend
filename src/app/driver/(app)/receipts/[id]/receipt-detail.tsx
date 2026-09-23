'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type { Receipt } from '@/lib/api/types';
import { dateTime, money, percent } from '@/lib/format';

/**
 * A driver's own receipt — `(console)/receipts/[id]/receipt-detail.tsx`'s
 * layout, narrowed to a phone width and with the admin-only credit-note
 * button left out (a driver reads a receipt; only staff issue a correction).
 */
export function ReceiptDetail({ id }: { id: string }) {
  const receipt = useQuery({
    queryKey: ['driver', 'receipt', id],
    queryFn: () => driverApiGet<Receipt>(`/driver/receipts/${id}`),
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
        description={`Issued ${dateTime(doc.issuedAt)}`}
      >
        <Button
          variant="outline"
          render={<Link href={`/driver/sessions/${doc.transactionId}`} />}
          nativeButton={false}
        >
          Session
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <Card size="sm">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Amounts</CardTitle>
            <div className="flex gap-1">
              <Badge variant="outline">
                {percent(doc.taxRateBp / 10000)} GST
              </Badge>
              {settled ? <Badge variant="secondary">credited in full</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Net" value={money(doc.netMinor, doc.currency)} />
            <Row label="Tax" value={money(doc.taxMinor, doc.currency)} />
            <Row label="Gross" value={money(doc.grossMinor, doc.currency)} />
            {doc.creditedNetMinor !== '0' ? (
              <>
                <Row
                  label="Credited"
                  value={money(doc.creditedNetMinor, doc.currency)}
                />
                <Row
                  label="Remaining"
                  value={money(doc.remainingNetMinor, doc.currency)}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {doc.taxLines.length > 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Tax</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {doc.taxLines.map((line) => (
                <Row
                  key={line.component}
                  label={`${line.component} (${line.ratePercent}%)`}
                  value={money(line.amountMinor, doc.currency)}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}

        {credited.length > 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Credit notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {credited.map((note) => (
                <div key={note.id} className="border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{note.documentNumber}</span>
                    <span>{money(note.grossMinor, note.currency)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {dateTime(note.issuedAt)} · {note.reason}
                    {note.note ? ` — ${note.note}` : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
