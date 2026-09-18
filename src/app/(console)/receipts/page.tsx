import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/query-state';
import { ReceiptsBoard } from './receipts-board';

export const metadata: Metadata = { title: 'Receipts' };

export default function ReceiptsPage() {
  // The board reads `transactionId` from the query string, which needs a
  // boundary to suspend against while the router resolves it.
  return (
    <Suspense fallback={<Loading />}>
      <ReceiptsBoard />
    </Suspense>
  );
}
