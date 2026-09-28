import type { Metadata } from 'next';
import { FleetOverview } from './overview';

export const metadata: Metadata = { title: 'Overview' };

export default function FleetOverviewPage() {
  return <FleetOverview />;
}
