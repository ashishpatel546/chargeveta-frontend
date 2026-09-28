import type { Metadata } from 'next';
import { FleetDriversView } from './drivers-view';

export const metadata: Metadata = { title: 'Drivers' };

export default function FleetDriversPage() {
  return <FleetDriversView />;
}
