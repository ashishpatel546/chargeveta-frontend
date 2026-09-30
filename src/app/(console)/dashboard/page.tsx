import type { Metadata } from 'next';
import { DashboardBoard } from './dashboard-board';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return <DashboardBoard />;
}
