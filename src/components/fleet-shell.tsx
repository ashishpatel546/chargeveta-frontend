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
import { Button } from '@/components/ui/button';
import type { FleetManagerMe } from '@/lib/api/fleet-types';
import { config } from '@/lib/config';
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
        <header className="border-b print:hidden">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <span className="font-semibold">
                <span aria-hidden className="mr-2 text-lg">
                  ⚡
                </span>
                {config.appName}
              </span>
              <span className="text-muted-foreground ml-2 truncate text-sm">
                {me.fleet.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:inline">
                {me.manager.name ?? me.manager.email}
              </span>
              <form action={fleetSignOut}>
                <Button type="submit" variant="ghost" size="sm">
                  <LogOutIcon className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-2">
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
                    'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm',
                    active
                      ? 'border-foreground text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-4 md:p-6 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </FleetProvider>
  );
}
