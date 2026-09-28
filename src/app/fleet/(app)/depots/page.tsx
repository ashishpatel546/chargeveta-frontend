import type { Metadata } from 'next';
import { FleetDepotsView } from './depots-view';

export const metadata: Metadata = { title: 'Depots' };

export default function FleetDepotsPage() {
  return <FleetDepotsView />;
}
