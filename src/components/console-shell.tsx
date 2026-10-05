'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BellIcon,
  CreditCardIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  KeyIcon,
  LayoutDashboardIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  PlugZapIcon,
  ReceiptIndianRupeeIcon,
  SettingsIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WebhookIcon,
} from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/notification-bell';
import { PrincipalMenu } from '@/components/principal-menu';
import { PrincipalProvider } from '@/components/principal-context';
import { RealtimeProvider } from '@/components/realtime-provider';
import { atLeast, hasModule, type Principal, type Role } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The weakest role the API will let through. */
  needs: Role;
  /** An optional module (`charveta` doc 4 §3.4) the operator must have on. */
  module?: string;
}

const OPERATIONS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
    needs: 'viewer',
  },
  { href: '/stations', label: 'Chargers', icon: PlugZapIcon, needs: 'viewer' },
  { href: '/sessions', label: 'Sessions', icon: GaugeIcon, needs: 'viewer' },
  { href: '/cards', label: 'Cards', icon: CreditCardIcon, needs: 'viewer' },
  { href: '/sites', label: 'Sites', icon: MapPinIcon, needs: 'viewer' },
  {
    href: '/fleets',
    label: 'Fleets',
    icon: TruckIcon,
    needs: 'viewer',
    module: 'fleet',
  },
];

const MONEY: NavItem[] = [
  {
    href: '/tariffs',
    label: 'Tariffs',
    icon: ReceiptIndianRupeeIcon,
    needs: 'viewer',
  },
  { href: '/receipts', label: 'Receipts', icon: FileTextIcon, needs: 'viewer' },
  { href: '/payments', label: 'Payments', icon: WalletIcon, needs: 'viewer' },
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
  { href: '/audit', label: 'Audit log', icon: HistoryIcon, needs: 'admin' },
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
        <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh w-64 shrink-0 flex-col lg:flex print:hidden">
          <Brand />
          <Nav principal={principal} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md md:px-6 lg:px-8 print:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="lg:hidden" />
                }
              >
                <MenuIcon className="size-5" />
                <span className="sr-only">Menu</span>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="bg-sidebar text-sidebar-foreground w-72 border-none p-0"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
                <Nav
                  principal={principal}
                  onNavigate={() => setMenuOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <Wordmark className="lg:hidden" />
            <div className="flex-1" />
            <NotificationBell />
            <PrincipalMenu principal={principal} />
          </header>

          <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 md:p-6 lg:p-8 print:p-0">
            {children}
          </main>
        </div>
      </div>
    </RealtimeProvider>
    </PrincipalProvider>
  );
}

function Brand() {
  return (
    <div className="flex h-16 shrink-0 items-center px-5 text-white">
      <Wordmark inverted />
    </div>
  );
}

function Nav({
  principal,
  onNavigate,
}: {
  principal: Principal;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6">
      {SECTIONS.map((section) => {
        const items = section.items.filter(
          (item) =>
            atLeast(principal.role, item.needs) &&
            (!item.module || hasModule(principal, item.module)),
        );
        if (items.length === 0) return null;
        return (
          <div key={section.title} className="space-y-1">
            <p className="text-sidebar-foreground/60 px-3 pb-1 text-xs font-medium">
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
                    'focus-visible:ring-sidebar-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'hover:bg-sidebar-accent/50 hover:text-white',
                  )}
                >
                  <item.icon className="size-4 opacity-80" />
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
