import type { Metadata } from 'next';
import { FleetSessionsView } from './sessions-view';

export const metadata: Metadata = { title: 'Sessions' };

export default function FleetSessionsPage() {
  return <FleetSessionsView />;
}
