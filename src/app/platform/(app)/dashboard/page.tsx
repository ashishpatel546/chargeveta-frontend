import type { Metadata } from 'next';
import { PlatformDashboardView } from './dashboard-view';

export const metadata: Metadata = { title: 'Dashboard' };

export default function PlatformDashboardPage() {
  return <PlatformDashboardView />;
}
