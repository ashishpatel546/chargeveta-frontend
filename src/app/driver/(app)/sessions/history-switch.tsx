'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const VIEWS = [
  { href: '/driver/sessions', label: 'Sessions' },
  { href: '/driver/receipts', label: 'Receipts' },
];

/**
 * Sessions and receipts are one history seen two ways (every receipt is a
 * session's), so they share the tab bar's one slot and switch here.
 */
export function HistorySwitch() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="History"
      className="bg-muted mb-5 inline-flex rounded-xl p-1 text-sm"
    >
      {VIEWS.map((view) => {
        const active = pathname.startsWith(view.href);
        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring rounded-lg px-4 py-1.5 font-medium transition-colors outline-none focus-visible:ring-2',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
