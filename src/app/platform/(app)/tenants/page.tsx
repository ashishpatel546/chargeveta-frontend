import type { Metadata } from 'next';
import { PlatformTenantsView } from './tenants-view';

export const metadata: Metadata = { title: 'Tenants' };

export default function PlatformTenantsPage() {
  return <PlatformTenantsView />;
}
