import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/query-state';
import { SitesBoard } from './sites-board';

export const metadata: Metadata = { title: 'Sites' };

export default function SitesPage() {
  // The board keeps its filters in the query string, which needs a boundary
  // to suspend against while the router resolves it.
  return (
    <Suspense fallback={<Loading />}>
      <SitesBoard />
    </Suspense>
  );
}
