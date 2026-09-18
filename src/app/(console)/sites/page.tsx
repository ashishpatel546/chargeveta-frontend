import type { Metadata } from 'next';
import { SitesBoard } from './sites-board';

export const metadata: Metadata = { title: 'Sites' };

export default function SitesPage() {
  return <SitesBoard />;
}
