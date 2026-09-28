import type { Metadata } from 'next';
import { FleetDetail } from './fleet-detail';

export const metadata: Metadata = { title: 'Fleet' };

export default async function FleetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FleetDetail id={id} />;
}
