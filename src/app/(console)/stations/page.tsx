import type { Metadata } from 'next';
import { StationsBoard } from './stations-board';

export const metadata: Metadata = { title: 'Chargers' };

export default function StationsPage() {
  return <StationsBoard />;
}
