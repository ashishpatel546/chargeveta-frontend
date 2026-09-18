import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/query-state';
import { CreditNotesBoard } from './credit-notes-board';

export const metadata: Metadata = { title: 'Credit notes' };

export default function CreditNotesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CreditNotesBoard />
    </Suspense>
  );
}
