'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BuildingIcon, KeyRoundIcon, LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlatformAdminMe } from '@/lib/api/platform-types';
import { config } from '@/lib/config';
import { platformSignOut } from '@/lib/server/platform-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [{ href: '/platform/tenants', label: 'Tenants', icon: BuildingIcon }];

/**
 * The platform console's chrome — `FleetShell`'s top bar and tabs. Everything
 * under it works across operators, so the bar says "platform" plainly: this
 * is not any one tenant's console.
 */
export function PlatformShell({
  me,
  children,
}: {
  me: PlatformAdminMe;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <span className="font-semibold">
              <span aria-hidden className="mr-2 text-lg">
                ⚡
              </span>
              {config.appName}
            </span>
            <span className="text-muted-foreground ml-2 truncate text-sm">
              Platform
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:inline">
              {me.name ?? me.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/platform/change-password" />}
            >
              <KeyRoundIcon className="size-4" />
              Change password
            </Button>
            <form action={platformSignOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOutIcon className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
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
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
