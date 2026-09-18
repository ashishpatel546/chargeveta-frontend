'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BellIcon,
  CreditCardIcon,
  FileTextIcon,
  GaugeIcon,
  KeyIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  PlugZapIcon,
  ReceiptIndianRupeeIcon,
  SettingsIcon,
  UsersIcon,
  WebhookIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/notification-bell';
import { PrincipalMenu } from '@/components/principal-menu';
import { PrincipalProvider } from '@/components/principal-context';
import { RealtimeProvider } from '@/components/realtime-provider';
import { atLeast, type Principal, type Role } from '@/lib/api/types';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The weakest role the API will let through. */
  needs: Role;
}

const OPERATIONS: NavItem[] = [
  { href: '/stations', label: 'Chargers', icon: PlugZapIcon, needs: 'viewer' },
  { href: '/sessions', label: 'Sessions', icon: GaugeIcon, needs: 'viewer' },
  { href: '/cards', label: 'Cards', icon: CreditCardIcon, needs: 'viewer' },
  { href: '/sites', label: 'Sites', icon: MapPinIcon, needs: 'viewer' },
];

const MONEY: NavItem[] = [
  {
    href: '/tariffs',
    label: 'Tariffs',
    icon: ReceiptIndianRupeeIcon,
    needs: 'viewer',
  },
  { href: '/receipts', label: 'Receipts', icon: FileTextIcon, needs: 'viewer' },
  { href: '/reports', label: 'Reports', icon: FileTextIcon, needs: 'viewer' },
];

const ADMIN: NavItem[] = [
  {
    href: '/notifications',
    label: 'Alerts',
    icon: BellIcon,
    needs: 'viewer',
  },
  { href: '/users', label: 'People', icon: UsersIcon, needs: 'admin' },
  { href: '/api-keys', label: 'API keys', icon: KeyIcon, needs: 'admin' },
  { href: '/messages', label: 'Messages', icon: MailIcon, needs: 'admin' },
  { href: '/webhooks', label: 'Webhooks', icon: WebhookIcon, needs: 'admin' },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    needs: 'viewer',
  },
];

const SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Operations', items: OPERATIONS },
  { title: 'Billing', items: MONEY },
  { title: 'Administration', items: ADMIN },
];

export function ConsoleShell({
  principal,
  children,
}: {
  principal: Principal;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <PrincipalProvider principal={principal}>
    <RealtimeProvider>
      <div className="flex min-h-full flex-1">
        <aside className="bg-sidebar hidden w-60 shrink-0 flex-col border-r md:flex">
          <Brand />
          <Nav role={principal.role} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="md:hidden" />
                }
              >
                <MenuIcon className="size-5" />
                <span className="sr-only">Menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
                <Nav
                  role={principal.role}
                  onNavigate={() => setMenuOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="flex-1" />
            <NotificationBell />
            <PrincipalMenu principal={principal} />
          </header>

          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
    </PrincipalProvider>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
      <span aria-hidden className="text-lg">
        ⚡
      </span>
      {config.appName}
    </div>
  );
}

function Nav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto p-3">
      {SECTIONS.map((section) => {
        const items = section.items.filter((item) => atLeast(role, item.needs));
        if (items.length === 0) return null;
        return (
          <div key={section.title} className="space-y-1">
            <p className="text-muted-foreground px-2 text-xs font-medium uppercase">
              {section.title}
            </p>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
