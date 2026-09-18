import type { Metadata } from 'next';
import { ReadsBoard } from './reads-board';

export const metadata: Metadata = { title: 'Card reads' };

export default function ReadsPage() {
  return <ReadsBoard />;
}
