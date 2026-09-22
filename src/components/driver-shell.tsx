'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon } from 'lucide-react';
import { DriverProvider, useDriver } from '@/components/driver-context';
import type { DriverDto } from '@/lib/api/driver-types';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

interface DriverNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * One tab today. Each later Phase P increment (cards, sessions, receipts,
 * wallet) adds its own entry here rather than its own shell — see
 * `charveta/docs/progress-tracer.md`'s Phase P plan.
 */
const NAV_ITEMS: DriverNavItem[] = [
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
      {label ? (
        <span className="text-muted-foreground max-w-32 truncate text-sm">
          {label}
        </span>
      ) : null}
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-background/95 fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md border-t backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
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
