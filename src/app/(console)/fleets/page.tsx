import type { Metadata } from 'next';
import { FleetsBoard } from './fleets-board';

export const metadata: Metadata = { title: 'Fleets' };

export default function FleetsPage() {
  return <FleetsBoard />;
}
