import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FleetStatementPage } from './statement-page';

export const metadata: Metadata = { title: 'Fleet statement' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <FleetStatementPage id={id} />
    </Suspense>
  );
}
