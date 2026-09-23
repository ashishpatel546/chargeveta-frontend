import type { Metadata } from 'next';
import { StationsView } from './stations-view';

export const metadata: Metadata = { title: 'Nearby' };

export default function DriverStationsPage() {
  return <StationsView />;
}
