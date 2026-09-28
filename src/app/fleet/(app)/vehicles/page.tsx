import type { Metadata } from 'next';
import { FleetVehiclesView } from './vehicles-view';

export const metadata: Metadata = { title: 'Vehicles' };

export default function FleetVehiclesPage() {
  return <FleetVehiclesView />;
}
