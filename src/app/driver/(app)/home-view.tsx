'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ChevronRightIcon,
  CreditCardIcon,
  MapPinIcon,
  PlugZapIcon,
  ReceiptIcon,
  ZapIcon,
} from 'lucide-react';
import { useDriver } from '@/components/driver-context';
import { Failed, Loading } from '@/components/driver-query-state';
import { LiveBeam } from '@/components/magicui/live-beam';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="heading text-[28px] leading-tight md:text-4xl">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>
        <p className="text-muted-foreground">
          {running ? 'Your car is charging.' : 'Ready when you are.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="space-y-4">
          {running ? <ChargingNow session={running} /> : <FindCharger />}

          {wallet.isPending ? <Loading rows={1} /> : null}
          {wallet.isError ? <Failed error={wallet.error} /> : null}
          {wallet.isSuccess ? <WalletCard wallet={wallet.data} /> : null}
        </div>

        <div className="space-y-6">
          <QuickActions />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="heading text-lg">Last session</h2>
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
                  Receipts can be emailed, and you can sign in with a password
                  as well as your phone.{' '}
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
      </div>
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

/** Two decimals of kWh, for the rolling live reading. */
const kwhFigure = (kwh: number) =>
  kwh.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The live session: the one place in the app where the amber current runs.
 * The kWh figure rolls to each new reading as the query refreshes.
 */
function ChargingNow({ session }: { session: DriverSessionDto }) {
  const limit = session.limit;
  const currency = limit?.currency ?? session.currency ?? undefined;
  const wh = Number(limit?.energyWh ?? session.energyWh ?? 0);
  const soc = limit?.socPercent ? Number(limit.socPercent) : null;
  return (
    <Link
      href={`/driver/sessions/${session.id}`}
      className="focus-visible:ring-ring bg-ink relative block rounded-[26px] p-5 text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:p-6 dark:ring-1 dark:ring-white/10"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sidebar-foreground min-w-0 truncate text-sm">
          {session.siteName ?? session.stationIdentity}
        </p>
        <span className="bg-live/15 text-live inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          <span aria-hidden className="bg-live size-1.5 animate-pulse rounded-full" />
          Charging
        </span>
      </div>

      <p className="mt-4">
        <NumberTicker
          value={Number.isFinite(wh) ? wh / 1000 : 0}
          format={kwhFigure}
          className="readout text-[64px] sm:text-[76px]"
        />
        <span className="text-sidebar-foreground ml-1.5 text-xl font-medium">
          kWh
        </span>
      </p>

      {soc !== null ? (
        <div className="mt-4 space-y-1.5">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/12"
            role="meter"
            aria-label="Battery"
            aria-valuenow={soc}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="bg-live h-full rounded-full transition-[width] duration-700"
              style={{ width: `${soc}%` }}
            />
          </div>
          <p className="text-sidebar-foreground text-xs">Battery {soc}%</p>
        </div>
      ) : null}

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
        <Stat label="Time" value={span(session.startedAt, undefined)} />
        <Stat label="Power" value={limit?.powerW ? power(limit.powerW) : '—'} />
        <Stat
          label="Cost so far"
          value={limit ? money(limit.runningCostMinor, currency) : '—'}
        />
      </dl>
      {limit && limit.remainingMinor !== null && limit.source !== 'none' ? (
        <p className="text-sidebar-foreground mt-3 text-xs">
          {money(limit.remainingMinor, currency)} left to spend
        </p>
      ) : null}
      <LiveBeam />
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sidebar-foreground text-xs">{label}</dt>
      <dd className="readout mt-1 truncate text-xl">{value}</dd>
    </div>
  );
}

/** What home leads with when nothing is charging: the way to the next one. */
function FindCharger() {
  return (
    <Card className="gap-4 rounded-[26px] p-1">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-2xl">
          <PlugZapIcon className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="heading text-xl">Find a charger</h2>
          <p className="text-muted-foreground text-sm">
            See which chargers near you are free, what they cost, and start
            charging from your phone.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          render={<Link href="/driver/stations" />}
          nativeButton={false}
        >
          <MapPinIcon />
          Show chargers nearby
        </Button>
      </CardContent>
    </Card>
  );
}

function WalletCard({ wallet }: { wallet: WalletDto }) {
  const owes = wallet.debtMinor !== '0';
  const low =
    !owes &&
    wallet.enabled &&
    Number(wallet.balanceMinor) < Number(wallet.minStartMinor);
  return (
    <Card className="rounded-[22px]">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">Wallet balance</p>
            <p className="readout mt-1.5 truncate text-[40px]">
              {money(wallet.balanceMinor, wallet.currency)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-1"
            render={<Link href="/driver/wallet" />}
            nativeButton={false}
          >
            Wallet
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        {owes ? (
          <p className="text-destructive text-sm">
            You owe {money(wallet.debtMinor, wallet.currency)} from an earlier
            session. Top up to keep charging from your wallet.
          </p>
        ) : low ? (
          <p className="text-muted-foreground text-sm">
            A wallet start needs at least{' '}
            {money(wallet.minStartMinor, wallet.currency)}.
          </p>
        ) : null}
        {wallet.enabled ? (
          <div className="[&_button]:w-full">
            <TopUpDialog wallet={wallet} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Your operator has not switched on wallet payments yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const ACTIONS = [
  { href: '/driver/cards', label: 'My cards', hint: 'Tap to charge', icon: CreditCardIcon },
  { href: '/driver/sessions', label: 'Sessions', hint: 'Every charge', icon: ZapIcon },
  { href: '/driver/receipts', label: 'Receipts', hint: 'To download', icon: ReceiptIcon },
];

function QuickActions() {
  return (
    <nav aria-label="Shortcuts" className="grid grid-cols-3 gap-2 sm:gap-3">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="bg-card hover:bg-muted/60 focus-visible:ring-ring flex flex-col gap-3 rounded-2xl border p-3 transition-colors outline-none focus-visible:ring-2 sm:p-4"
        >
          <action.icon className="text-muted-foreground size-5" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{action.label}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {action.hint}
            </span>
          </span>
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
    <Link href={href} className="focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2">
      <Card size="sm" className="hover:bg-muted/40 transition-colors">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {session.siteName ?? session.stationIdentity}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {dateTime(session.startedAt)},{' '}
              {span(session.startedAt, session.stoppedAt ?? undefined)}
              {session.energyWh ? `, ${energy(session.energyWh)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="readout text-lg">
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
