'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BellIcon,
  CreditCardIcon,
  HomeIcon,
  MapPinIcon,
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
import { Wordmark } from '@/components/brand';
import { cn } from '@/lib/utils';

interface DriverNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Other paths that belong to this tab (receipts live under Sessions). */
  also?: string[];
}

/**
 * Doc 6 §22.3/§22.4: everything a signed-in driver's tab bar reaches. Five,
 * the most a phone's tab bar holds comfortably; receipts are reached from
 * Sessions, since every receipt is a session's.
 */
const NAV_ITEMS: DriverNavItem[] = [
  { href: '/driver', label: 'Home', icon: HomeIcon },
  { href: '/driver/stations', label: 'Nearby', icon: MapPinIcon },
  {
    href: '/driver/sessions',
    label: 'Sessions',
    icon: ZapIcon,
    also: ['/driver/receipts'],
  },
  { href: '/driver/wallet', label: 'Wallet', icon: WalletIcon },
  { href: '/driver/cards', label: 'Cards', icon: CreditCardIcon },
];

function isActive(item: DriverNavItem, pathname: string): boolean {
  if (item.href === '/driver') return pathname === '/driver';
  return [item.href, ...(item.also ?? [])].some((href) =>
    pathname.startsWith(href),
  );
}

/**
 * The chrome every signed-in driver screen sits inside. On a phone — what it
 * is installed as (`charveta` doc 4 §11: "ships as a PWA") — a slim header and
 * a floating tab bar clear of the home indicator. From a tablet up, the tabs
 * become a side rail and the screen gets room for two columns, rather than a
 * phone-width strip in the middle of a monitor.
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
      <div className="flex min-h-full flex-1">
        <SideRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="roomy mx-auto w-full max-w-[1100px] min-w-0 flex-1 px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-8 md:pb-12">
            {children}
          </main>
        </div>
        <TabBar />
      </div>
    </DriverProvider>
  );
}

function Header() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6 md:h-16 md:px-8">
      <Link href="/driver" className="rounded-lg md:hidden" aria-label="Home">
        <Wordmark />
      </Link>
      <span className="hidden md:block" />
      <div className="flex items-center gap-1">
        <NotificationsBell />
        <AccountLink />
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
      className="hover:bg-muted focus-visible:ring-ring relative grid size-11 place-items-center rounded-full transition-colors outline-none focus-visible:ring-2"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <BellIcon className="size-5" />
      {count > 0 ? (
        <span className="bg-destructive ring-background absolute top-1.5 right-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white ring-2">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Account lives in the header, beside the bell, since the home screen took
 * its tab: settings are visited rarely, and the tab bar is for what is not.
 * Shown as the driver's initial, the way a phone app shows "you".
 */
function AccountLink() {
  const driver = useDriver();
  const pathname = usePathname();
  const active = pathname.startsWith('/driver/account');
  const initial = (driver.name ?? driver.email ?? '').trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/driver/account"
      aria-label="Account"
      aria-current={active ? 'page' : undefined}
      className="focus-visible:ring-ring grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2"
    >
      <span
        className={cn(
          'grid size-8 place-items-center rounded-full text-sm font-semibold transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {initial || <UserIcon className="size-4" />}
      </span>
    </Link>
  );
}

/** The phone's tab bar: floating, frosted, clear of the home indicator. */
function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:hidden"
    >
      <div className="bg-card/85 grid grid-cols-5 rounded-[22px] border p-1.5 shadow-[0_12px_32px_-12px_rgb(26_33_80/0.35)] backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] transition-colors outline-none focus-visible:ring-2',
                active
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground active:bg-muted',
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The same tabs as a side rail, from a tablet up. */
function SideRail() {
  const pathname = usePathname();
  return (
    <aside className="bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 md:flex lg:w-64">
      <Link href="/driver" className="flex h-16 items-center px-3" aria-label="Home">
        <Wordmark />
      </Link>
      <nav aria-label="Main" className="mt-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2',
                active
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
