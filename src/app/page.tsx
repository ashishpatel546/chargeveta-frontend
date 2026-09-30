import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/session';

/**
 * The root only ever points somewhere else. The console proper starts at the
 * dashboard — what is happening across the tenant, with the chargers board one
 * click away — which is the first question an owner or operator opens this
 * with (owner's call, 2026-09-30; it was the chargers board before).
 */
export default async function RootPage() {
  redirect((await readSession()) ? '/dashboard' : '/sign-in');
}
