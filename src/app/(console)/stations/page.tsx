import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/query-state';
import { StationsBoard } from './stations-board';

export const metadata: Metadata = { title: 'Chargers' };

export default function StationsPage() {
  // The board keeps its filters in the query string, which needs a boundary
  // to suspend against while the router resolves it.
  return (
    <Suspense fallback={<Loading />}>
      <StationsBoard />
    </Suspense>
  );
}
