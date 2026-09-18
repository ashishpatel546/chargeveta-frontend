import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/session';

/**
 * The root only ever points somewhere else. The console proper starts at the
 * chargers board, which is what an operator opens this for.
 */
export default async function RootPage() {
  redirect((await readSession()) ? '/stations' : '/sign-in');
}
