import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FleetStatementView } from './statement-view';

export const metadata: Metadata = { title: 'Statement' };

export default function FleetStatementPage() {
  return (
    <Suspense>
      <FleetStatementView />
    </Suspense>
  );
}
