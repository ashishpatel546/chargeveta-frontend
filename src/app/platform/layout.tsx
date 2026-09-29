import type { Metadata } from 'next';
import { config } from '@/lib/config';

/**
 * The top of the platform console — where whoever runs this installation
 * creates, suspends and reinstates operators (tenants). Shared by the public
 * sign-in page, the change-password page and, nested inside, `(app)`
 * (everything behind `requirePlatformAdmin()`). Not itself gated, and not
 * installable: it is a desk tool used rarely, by very few people.
 */
export const metadata: Metadata = {
  title: {
    default: `${config.appName} platform`,
    template: `%s · ${config.appName} platform`,
  },
  description: 'Create, suspend and reinstate the operators on this installation.',
  robots: { index: false, follow: false },
};

export default function PlatformLayout({ children }: LayoutProps<'/platform'>) {
  return children;
}
