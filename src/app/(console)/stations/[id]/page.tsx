import type { Metadata } from 'next';
import { StationDetail } from './station-detail';

export const metadata: Metadata = { title: 'Charger' };

export default async function StationPage({
  params,
}: PageProps<'/stations/[id]'>) {
  const { id } = await params;
  return <StationDetail stationId={id} />;
}
