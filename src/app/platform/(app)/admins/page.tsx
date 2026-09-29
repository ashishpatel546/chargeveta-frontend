import type { Metadata } from 'next';
import { PlatformAdminsView } from './admins-view';
import { requirePlatformAdmin } from '@/lib/server/platform-principal';

export const metadata: Metadata = { title: 'Admins' };

export default async function PlatformAdminsPage() {
  // Who is looking, so their own row offers nothing they would be refused.
  const me = await requirePlatformAdmin();
  return <PlatformAdminsView meId={me.id} />;
}
