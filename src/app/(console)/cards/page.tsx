import type { Metadata } from 'next';
import { CardsBoard } from './cards-board';

export const metadata: Metadata = { title: 'Cards' };

export default function CardsPage() {
  return <CardsBoard />;
}
