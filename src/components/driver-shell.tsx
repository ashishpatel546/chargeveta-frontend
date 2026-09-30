'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BellIcon,
  CreditCardIcon,
  MapPinIcon,
  ReceiptIcon,
  UserIcon,
  WalletIcon,
  ZapIcon,
} from 'lucide-react';
import { DriverProvider, useDriver } from '@/components/driver-context';
import { driverApiGet } from '@/lib/api/driver-client';
import type {
  DriverDto,
  DriverNotificationPage,
} from '@/lib/api/driver-types';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

interface DriverNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Doc 6 §22.3/§22.4: everything a signed-in driver's bottom tab bar reaches. */
const NAV_ITEMS: DriverNavItem[] = [
  { href: '/driver/stations', label: 'Nearby', icon: MapPinIcon },
  { href: '/driver/sessions', label: 'Sessions', icon: ZapIcon },
  { href: '/driver/wallet', label: 'Wallet', icon: WalletIcon },
  { href: '/driver/cards', label: 'Cards', icon: CreditCardIcon },
  { href: '/driver/receipts', label: 'Receipts', icon: ReceiptIcon },
  { href: '/driver', label: 'Account', icon: UserIcon },
];

/**
 * The chrome every signed-in driver screen sits inside — mobile-first and
 * narrow even on a desktop browser, because that is what it is installed as
 * (`charveta` doc 4 §11: "ships as a PWA"). A bottom tab bar rather than
 * `ConsoleShell`'s sidebar, the idiomatic shape for a small screen and an
 * "app-like" feel — see `manifest.ts` for the second install target this
 * sits under.
 */
export function DriverShell({
  driver,
  children,
}: {
  driver: DriverDto;
  children: React.ReactNode;
}) {
  return (
    <DriverProvider driver={driver}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 p-4 pb-20">{children}</main>
        <BottomNav />
      </div>
    </DriverProvider>
  );
}

function Header() {
  const driver = useDriver();
  const label = driver.name ?? driver.email ?? driver.phone ?? '';
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <span className="font-semibold">
        <span aria-hidden className="mr-2 text-lg">
          ⚡
        </span>
        {config.appName}
      </span>
      <div className="flex items-center gap-3">
        {label ? (
          <span className="text-muted-foreground max-w-32 truncate text-sm">
            {label}
          </span>
        ) : null}
        <NotificationsBell />
      </div>
    </header>
  );
}

/**
 * The way to the notification history (`charveta` doc 6 §22.3), with how many
 * are unread. The tab bar is full, and this is where a phone app keeps it.
 */
function NotificationsBell() {
  const unread = useQuery({
    // The same key the notifications screen invalidates once it marks them read.
    queryKey: ['driver', 'notifications', 'unread'],
    queryFn: () =>
      driverApiGet<DriverNotificationPage>('/driver/notifications', {
        limit: '1',
      }),
    select: (page) => page.unread,
    refetchInterval: 60_000,
  });
  const count = unread.data ?? 0;
  return (
    <Link
      href="/driver/notifications"
      className="relative"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <BellIcon className="size-5" />
      {count > 0 ? (
        <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-background/95 fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md border-t backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === '/driver'
            ? pathname === '/driver'
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
              active
                ? 'text-foreground font-medium'
                : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
