'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CarIcon,
  FileTextIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  UsersIcon,
  WarehouseIcon,
} from 'lucide-react';
import { FleetProvider } from '@/components/fleet-context';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import type { FleetManagerMe } from '@/lib/api/fleet-types';
import { fleetSignOut } from '@/lib/server/fleet-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/fleet', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/fleet/drivers', label: 'Drivers', icon: UsersIcon },
  { href: '/fleet/vehicles', label: 'Vehicles', icon: CarIcon },
  { href: '/fleet/depots', label: 'Depots', icon: WarehouseIcon },
  { href: '/fleet/sessions', label: 'Sessions', icon: GaugeIcon },
  { href: '/fleet/statement', label: 'Statement', icon: FileTextIcon },
];

/**
 * The fleet portal's chrome: a top bar and a row of tabs, since a fleet
 * manager works at a desk rather than at a charger. Everything under it reads
 * only the manager's own fleet — the API takes the fleet from their session,
 * never from a URL.
 */
export function FleetShell({
  me,
  children,
}: {
  me: FleetManagerMe;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <FleetProvider me={me}>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="bg-ink text-white print:hidden">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
            <div className="min-w-0">
              <Wordmark inverted suffix={me.fleet.name} className="min-w-0 [&>span:last-child]:truncate" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sidebar-foreground hidden max-w-48 truncate text-sm md:inline">
                {me.manager.name ?? me.manager.email}
              </span>
              <form action={fleetSignOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Sign out"
                >
                  <LogOutIcon className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            </div>
          </div>
          <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-2 md:px-4 [scrollbar-width:none]">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/fleet'
                  ? pathname === '/fleet'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'border-white font-medium text-white'
                      : 'text-sidebar-foreground border-transparent hover:text-white',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-4 md:p-6 lg:p-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </FleetProvider>
  );
}
