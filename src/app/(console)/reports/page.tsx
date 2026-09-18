import type { Metadata } from 'next';
import { ReportsBoard } from './reports-board';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return <ReportsBoard />;
}
