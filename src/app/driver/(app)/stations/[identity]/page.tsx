import type { Metadata } from 'next';
import { StationDetail } from './station-detail';

export const metadata: Metadata = { title: 'Charger' };

export default async function DriverStationPage({
  params,
}: {
  params: Promise<{ identity: string }>;
}) {
  const { identity } = await params;
  return <StationDetail identity={identity} />;
}
