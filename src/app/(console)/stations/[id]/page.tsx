import type { Metadata } from 'next';
import { BackButton } from '@/components/back-button';
import { StationDetail } from './station-detail';

export const metadata: Metadata = { title: 'Charger' };

export default async function StationPage({
  params,
}: PageProps<'/stations/[id]'>) {
  const { id } = await params;
  return (
    <>
      <BackButton fallback="/stations" />
      <StationDetail stationId={id} />
    </>
  );
}
