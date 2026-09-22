import type { Metadata } from 'next';
import { config } from '@/lib/config';

/**
 * The top of the driver tree — shared by the public sign-in/register/link
 * pages and, nested inside it, `(app)` (everything that needs
 * `requireDriver()`). Not itself gated: a visitor with no session at all must
 * still reach `/driver/sign-in`.
 *
 * Overrides `manifest` for everything under `/driver`, so "Add to Home
 * Screen" here installs the driver app (`driver/manifest.webmanifest`) rather
 * than inheriting the operator console's manifest from the root layout.
 */
export const metadata: Metadata = {
  title: { default: `${config.appName} driver`, template: `%s · ${config.appName}` },
  description: 'Find a charger, start and stop charging, and pay.',
  manifest: '/driver/manifest.webmanifest',
  appleWebApp: { capable: true, title: `${config.appName} driver` },
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: LayoutProps<'/driver'>) {
  return children;
}
