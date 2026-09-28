import type { Metadata } from 'next';
import { config } from '@/lib/config';

/**
 * The top of the fleet portal (`charveta` doc 6 §23) — where a fleet manager
 * sees their company's drivers, vehicles, depots, sessions and bill. Shared by
 * the public sign-in and setup pages and, nested inside, `(app)` (everything
 * behind `requireFleetManager()`). Not itself gated: a manager with no session
 * must still reach `/fleet/sign-in`, and the invitation email links to
 * `/fleet/setup`.
 */
export const metadata: Metadata = {
  title: { default: `${config.appName} fleet`, template: `%s · ${config.appName} fleet` },
  description: 'Your fleet’s drivers, vehicles, depots, sessions and billing.',
  robots: { index: false, follow: false },
};

export default function FleetLayout({ children }: LayoutProps<'/fleet'>) {
  return children;
}
