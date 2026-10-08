import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/query-state';
import { SessionsBoard } from './sessions-board';

export const metadata: Metadata = { title: 'Sessions' };

export default function SessionsPage() {
  // The board keeps its filters in the query string, which needs a boundary
  // to suspend against while the router resolves it.
  return (
    <Suspense fallback={<Loading />}>
      <SessionsBoard />
    </Suspense>
  );
}
