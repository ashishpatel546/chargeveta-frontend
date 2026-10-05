'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BuildingIcon,
  LayoutDashboardIcon,
  KeyRoundIcon,
  LogOutIcon,
  ScrollTextIcon,
  UsersIcon,
} from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import type { PlatformAdminMe } from '@/lib/api/platform-types';
import { platformSignOut } from '@/lib/server/platform-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/platform/tenants', label: 'Tenants', icon: BuildingIcon },
  { href: '/platform/admins', label: 'Admins', icon: UsersIcon },
  { href: '/platform/audit', label: 'Audit log', icon: ScrollTextIcon },
];

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
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="min-w-0">
            <Wordmark inverted suffix="platform" className="min-w-0 [&>span:last-child]:truncate" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sidebar-foreground hidden max-w-48 truncate text-sm md:inline">
              {me.name ?? me.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Change password"
              nativeButton={false}
              render={<Link href="/platform/change-password" />}
            >
              <KeyRoundIcon className="size-4" />
              <span className="hidden sm:inline">Change password</span>
            </Button>
            <form action={platformSignOut}>
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
            const active = pathname.startsWith(item.href);
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
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
