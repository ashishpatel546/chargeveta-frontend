import type { Metadata } from 'next';
import { CardsView } from './cards-view';

export const metadata: Metadata = { title: 'Cards' };

export default function DriverCardsPage() {
  return <CardsView />;
}
