import type { Metadata } from 'next';
import { TariffsBoard } from './tariffs-board';

export const metadata: Metadata = { title: 'Tariffs' };

export default function TariffsPage() {
  return <TariffsBoard />;
}
