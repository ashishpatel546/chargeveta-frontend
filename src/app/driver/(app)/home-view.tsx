'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ChevronRightIcon,
  CreditCardIcon,
  MapPinIcon,
  ReceiptIcon,
  ZapIcon,
} from 'lucide-react';
import { useDriver } from '@/components/driver-context';
import { Failed, Loading } from '@/components/driver-query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { driverApiGet } from '@/lib/api/driver-client';
import type {
  DriverSessionDto,
  DriverSessionPage,
  WalletDto,
} from '@/lib/api/driver-types';
import { dateTime, energy, money, power, span } from '@/lib/format';
import { TopUpDialog } from './wallet/wallet-view';

/**
 * The driver's home screen (`charveta` doc 6 §22.3): what is charging now,
 * the wallet with a way to top it up, the last session, and the way to the
 * next one. Everything here is also on its own screen; this only gathers the
 * first thing a driver opening the app wants to know.
 *
 * Reads the same endpoints, under their own query keys where the shape
 * differs (a short session list), so nothing here can leave another screen
 * holding a half-loaded list.
 */
export function HomeView() {
  const driver = useDriver();

  const sessions = useQuery({
    queryKey: ['driver', 'sessions', 'home'],
    queryFn: () =>
      driverApiGet<DriverSessionPage>('/driver/sessions', { limit: '5' }),
    // A running session's cost moves; refresh while one is open.
    refetchInterval: (query) =>
      query.state.data?.items.some((session) => !session.stoppedAt)
        ? 10_000
        : false,
  });

  const wallet = useQuery({
    queryKey: ['driver', 'wallet'],
    queryFn: () => driverApiGet<WalletDto>('/driver/wallet'),
  });

  const items = sessions.data?.items ?? [];
  const running = items.find((session) => !session.stoppedAt);
  const last = items.find((session) => session.stoppedAt);
  const firstName = driver.name?.trim().split(/\s+/)[0];
  const greeting = useGreeting();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        <p className="text-muted-foreground text-sm">
          {running ? 'Your car is charging.' : 'Ready when you are.'}
        </p>
      </div>

      {running ? <ChargingNow session={running} /> : null}

      {wallet.isPending ? <Loading rows={1} /> : null}
      {wallet.isError ? <Failed error={wallet.error} /> : null}
      {wallet.isSuccess ? <WalletCard wallet={wallet.data} /> : null}

      <QuickActions />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Last session</h2>
          {items.length > 0 ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              render={<Link href="/driver/sessions" />}
              nativeButton={false}
            >
              All sessions
            </Button>
          ) : null}
        </div>
        {sessions.isPending ? <Loading rows={1} /> : null}
        {sessions.isError ? <Failed error={sessions.error} /> : null}
        {sessions.isSuccess && !last ? (
          <Card size="sm">
            <CardContent className="text-muted-foreground text-sm">
              {running
                ? 'Your first session is still running.'
                : 'No sessions yet. Find a charger nearby and start one with your card or from here.'}
            </CardContent>
          </Card>
        ) : null}
        {last ? <LastSession session={last} /> : null}
      </section>

      {!driver.email ? (
        <Alert>
          <AlertTitle>Add an email</AlertTitle>
          <AlertDescription>
            <span>
              Receipts can be emailed, and you can sign in with a password as
              well as your phone.{' '}
              <Link
                href="/driver/account"
                className="underline underline-offset-4"
              >
                Go to Account
              </Link>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * "Good morning" and so on by the driver's own clock. The server renders
 * this page too and cannot know that clock, so it says "Hello" and the
 * browser swaps in the real one: `useSyncExternalStore`'s server snapshot is
 * what keeps that from being a hydration mismatch. Checked once a minute, so
 * an app left open over an evening does not keep saying good afternoon.
 */
function useGreeting(): string {
  return useSyncExternalStore(subscribeToMinute, greetingNow, () => 'Hello');
}

function subscribeToMinute(onChange: () => void): () => void {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

function greetingNow(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ChargingNow({ session }: { session: DriverSessionDto }) {
  const limit = session.limit;
  const currency = limit?.currency ?? session.currency ?? undefined;
  return (
    <Link href={`/driver/sessions/${session.id}`} className="block">
      <Card size="sm" className="border-sky-600/40 bg-sky-600/5">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Charging now</p>
              <p className="truncate font-medium">
                {session.siteName ?? session.stationIdentity}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 border-sky-600/30 bg-sky-600/10 font-medium text-sky-700 dark:text-sky-400"
            >
              <ZapIcon className="size-3" />
              running
            </Badge>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Time" value={span(session.startedAt, undefined)} />
            <Stat
              label="Energy"
              value={energy(limit?.energyWh ?? session.energyWh ?? undefined)}
            />
            <Stat
              label="Cost so far"
              value={
                limit ? money(limit.runningCostMinor, currency) : '—'
              }
            />
          </dl>
          {limit?.powerW || limit?.socPercent ? (
            <p className="text-muted-foreground text-xs">
              {limit.powerW ? power(limit.powerW) : null}
              {limit.powerW && limit.socPercent ? ' · ' : null}
              {limit.socPercent ? `battery ${limit.socPercent}%` : null}
              {limit.remainingMinor !== null && limit.source !== 'none'
                ? ` · ${money(limit.remainingMinor, currency)} left to spend`
                : null}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function WalletCard({ wallet }: { wallet: WalletDto }) {
  const owes = wallet.debtMinor !== '0';
  const low =
    !owes &&
    wallet.enabled &&
    Number(wallet.balanceMinor) < Number(wallet.minStartMinor);
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Wallet balance</p>
            <p className="text-2xl font-semibold">
              {money(wallet.balanceMinor, wallet.currency)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/driver/wallet" />}
            nativeButton={false}
          >
            Wallet
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        {owes ? (
          <p className="text-destructive text-xs">
            You owe {money(wallet.debtMinor, wallet.currency)} from an earlier
            session. Top up to keep charging from your wallet.
          </p>
        ) : low ? (
          <p className="text-muted-foreground text-xs">
            A wallet start needs at least{' '}
            {money(wallet.minStartMinor, wallet.currency)}.
          </p>
        ) : null}
        {wallet.enabled ? (
          <TopUpDialog wallet={wallet} />
        ) : (
          <p className="text-muted-foreground text-xs">
            Your operator has not switched on wallet payments yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const ACTIONS = [
  { href: '/driver/stations', label: 'Find a charger', icon: MapPinIcon },
  { href: '/driver/cards', label: 'My cards', icon: CreditCardIcon },
  { href: '/driver/sessions', label: 'Sessions', icon: ZapIcon },
  { href: '/driver/receipts', label: 'Receipts', icon: ReceiptIcon },
];

function QuickActions() {
  return (
    <nav aria-label="Shortcuts" className="grid grid-cols-2 gap-2">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="bg-card hover:bg-muted/60 flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors"
        >
          <action.icon className="text-muted-foreground size-4" />
          {action.label}
        </Link>
      ))}
    </nav>
  );
}

function LastSession({ session }: { session: DriverSessionDto }) {
  const href = session.receiptId
    ? `/driver/receipts/${session.receiptId}`
    : `/driver/sessions/${session.id}`;
  return (
    <Link href={href} className="block">
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {session.siteName ?? session.stationIdentity}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {dateTime(session.startedAt)} ·{' '}
              {span(session.startedAt, session.stoppedAt ?? undefined)}
              {session.energyWh ? ` · ${energy(session.energyWh)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-sm font-medium">
              {session.costStatus === 'priced'
                ? money(
                    session.netMinor ?? undefined,
                    session.currency ?? undefined,
                  )
                : '—'}
            </span>
            <span className="text-muted-foreground text-xs">
              {session.receiptId ? 'Receipt' : 'Details'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
