'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Readout } from '@/components/readout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiSend } from '@/lib/api/client';
import type {
  LoadReason,
  LoadSession,
  LoadStatus,
  LoadWindow,
  Site,
} from '@/lib/api/types';
import { dateTime, power } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Watts as the page shows them; `power` takes the API's string form. */
const kw = (w: number | null | undefined) =>
  w === null || w === undefined ? '—' : power(String(w));

const REASONS: Record<LoadReason, { label: string; hint: string; tone: Tone }> = {
  shared: {
    label: 'Fair share',
    hint: 'Its part of what the site has to give.',
    tone: 'ok',
  },
  capped: {
    label: 'Charger maximum',
    hint: 'All the charger can deliver; the rest went to others.',
    tone: 'ok',
  },
  underuse: {
    label: 'Car taking less',
    hint: 'The car draws less than it was offered — a car near full, or one that charges slower than the charger — so the spare went to others, including the other connector of the same charger. It gets more as soon as it draws more.',
    tone: 'ok',
  },
  held: {
    label: 'Waiting',
    hint: 'Not enough power for its minimum. It starts when another session ends or the budget rises.',
    tone: 'caution',
  },
  fixed: {
    label: 'Unreachable',
    hint: 'The charger cannot be reached, or refused its last limit, so it is counted at what it holds.',
    tone: 'caution',
  },
};

type Tone = 'ok' | 'caution';

const toneClass: Record<Tone, string> = {
  ok: 'border-ok/30 bg-ok/10 text-ok-ink',
  caution: 'border-caution/30 bg-caution/10 text-caution-ink',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Base UI's `SelectValue` shows the label only when the items are given. */
const STRATEGY_ITEMS = [
  { value: 'equal', label: 'Equally between sessions' },
  { value: 'fifo', label: 'First to arrive is filled first' },
];

export function SiteLoad({ id }: { id: string }) {
  const site = useQuery({
    queryKey: ['site', id],
    queryFn: () => apiGet<Site>(`/locations/${id}`),
  });
  const load = useQuery({
    queryKey: ['site', id, 'load'],
    queryFn: () => apiGet<LoadStatus>(`/locations/${id}/load-management`),
    // A screen operators watch while sessions start and stop.
    refetchInterval: 10_000,
  });

  if (site.isPending || load.isPending) return <Loading />;
  if (site.isError) return <Failed error={site.error} />;
  if (load.isError) return <Failed error={load.error} />;

  const status = load.data;
  const policy = status.policy;
  const enabled = policy?.enabled ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={site.data.name}
        description="Load management shares this site’s power between the cars charging here, so together they never draw more than the supply allows."
      >
        <Badge
          variant="outline"
          className={cn('font-medium', enabled ? toneClass.ok : '')}
        >
          {enabled ? 'Load management on' : 'Load management off'}
        </Badge>
      </PageHeader>

      {enabled ? <Overview status={status} /> : null}
      {enabled ? <Sessions sessions={status.sessions} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyCard
          key={policy?.updatedAt ?? 'none'}
          siteId={id}
          status={status}
          hasZone={site.data.timeZone !== null}
        />
        <Chargers status={status} />
      </div>
    </div>
  );
}

function Overview({ status }: { status: LoadStatus }) {
  const budget = status.budgetNowW ?? 0;
  const used = budget > 0 ? Math.min(1, status.allocatedW / budget) : 0;
  const held = status.sessions.filter((s) => s.reason === 'held').length;
  const policy = status.policy!;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Budget now"
            value={kw(status.budgetNowW)}
            note={
              status.windowNow
                ? `${status.windowNow.from}–${status.windowNow.to} window`
                : `Site capacity`
            }
          />
          <Figure
            label="Given to sessions"
            value={kw(status.allocatedW)}
            note={`${status.sessions.length} session${status.sessions.length === 1 ? '' : 's'}${held > 0 ? `, ${held} waiting` : ''}`}
          />
          <Figure
            label="Drawing"
            value={kw(status.drawW)}
            note="From the chargers’ latest readings"
          />
          <Figure
            label="Fallback per EVSE"
            value={kw(status.failsafePerEvseW)}
            note={
              status.silentStations > 0
                ? `What each charger keeps if it loses us; ${status.silentStations} not heard from in ${status.silentAfterDays} days not counted`
                : 'What each charger keeps if it loses us'
            }
          />
        </div>
        <div className="space-y-1.5">
          <div
            className="bg-muted h-2.5 overflow-hidden rounded-full"
            role="meter"
            aria-label="Share of the budget given to sessions"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(used * 100)}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                used >= 0.95 ? 'bg-caution' : 'bg-ok',
              )}
              style={{ width: `${used * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {Math.round(used * 100)}% of the budget given out.
            {policy.lastRunAt
              ? ` Rebalanced ${dateTime(policy.lastRunAt)}.`
              : ' Not balanced yet.'}
            {policy.lastError ? ` Last attempt failed: ${policy.lastError}` : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <Readout value={value} className="text-3xl" />
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  );
}

function Sessions({ sessions }: { sessions: LoadSession[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Charging now</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <Empty>No sessions at this site right now.</Empty>
        ) : (
          <>
          {/* A phone gets one block per session: the table's useful columns
              would otherwise sit off-screen. */}
          <ul className="divide-y md:hidden">
            {sessions.map((session) => {
              const reason = REASONS[session.reason];
              const refused =
                session.outcome !== null &&
                session.outcome !== 'answered:Accepted';
              return (
                <li key={session.transactionId} className="space-y-1.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/stations/${session.stationId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {session.stationIdentity}
                      <span className="text-muted-foreground text-xs font-normal">
                        {' '}
                        · EVSE {session.evseNumber}
                      </span>
                    </Link>
                    <Badge
                      variant="outline"
                      title={reason.hint}
                      className={cn('font-medium', toneClass[reason.tone])}
                    >
                      {reason.label}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    Allowed <strong>{kw(session.sentW)}</strong>
                    {session.sentLimit !== null && session.sentUnit === 'A'
                      ? ` (${session.sentLimit} A)`
                      : ''}
                    <span className="text-muted-foreground">
                      {' '}
                      · drawing {kw(session.drawW)}
                      {session.socPercent !== null
                        ? ` · battery ${Math.round(session.socPercent)}%`
                        : ''}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    <Link
                      href={`/sessions/${session.transactionId}`}
                      className="font-mono underline-offset-4 hover:underline"
                    >
                      {session.transactionRef}
                    </Link>{' '}
                    ·{' '}
                    {session.outcome === null
                      ? 'not sent yet'
                      : refused
                        ? `charger answered ${session.outcome.replace('answered:', '')}`
                        : 'accepted'}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charger</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Drawing</TableHead>
                  <TableHead className="text-right">Allowed</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead>Charger answered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const reason = REASONS[session.reason];
                  const refused =
                    session.outcome !== null &&
                    session.outcome !== 'answered:Accepted';
                  return (
                    <TableRow key={session.transactionId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link
                          href={`/stations/${session.stationId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {session.stationIdentity}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {' '}
                          · EVSE {session.evseNumber}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <Link
                          href={`/sessions/${session.transactionId}`}
                          className="font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {session.transactionRef}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          since {dateTime(session.startedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {kw(session.drawW)}
                        {session.socPercent !== null ? (
                          <span className="text-muted-foreground block text-xs">
                            battery {Math.round(session.socPercent)}%
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {kw(session.sentW)}
                        {session.sentLimit !== null &&
                        session.sentUnit === 'A' ? (
                          <span className="text-muted-foreground block text-xs">
                            {session.sentLimit} A
                          </span>
                        ) : null}
                        {session.sentW !== session.targetW ? (
                          <span className="text-muted-foreground block text-xs">
                            aiming for {kw(session.targetW)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          title={reason.hint}
                          className={cn('font-medium', toneClass[reason.tone])}
                        >
                          {reason.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Answer
                          outcome={session.outcome}
                          detail={session.detail}
                          at={session.sentAt}
                          refused={refused}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Answer({
  outcome,
  detail,
  at,
  refused,
}: {
  outcome: string | null;
  detail: string | null;
  at: string | null;
  refused: boolean;
}) {
  if (outcome === null) {
    return <span className="text-muted-foreground">Not sent yet</span>;
  }
  return (
    <span className={cn(refused ? 'text-caution-ink' : '')} title={detail ?? undefined}>
      {refused ? outcome.replace('answered:', '').replace(/_/g, ' ') : 'Accepted'}
      {at ? (
        <span className="text-muted-foreground block text-xs">
          {dateTime(at)}
        </span>
      ) : null}
    </span>
  );
}

function Chargers({ status }: { status: LoadStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chargers here</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.stations.length === 0 ? (
          <Empty>No chargers are placed at this site.</Empty>
        ) : (
          <ul className="divide-y">
            {status.stations.map((station) => (
              <li key={station.id} className="space-y-1 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/stations/${station.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {station.identity}
                  </Link>
                  <span
                    className={cn(
                      'text-xs',
                      station.online ? 'text-ok-ink' : 'text-muted-foreground',
                    )}
                  >
                    {station.online ? 'Online' : 'Not heard from'}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  OCPP {station.ocppVersion} ·{' '}
                  {station.maxPowerW
                    ? `${kw(station.maxPowerW)} shared by its connectors`
                    : 'no rating set'}{' '}
                  · limits in {station.chargingRateUnit === 'A' ? 'amps' : 'watts'}
                  {station.chargingRateUnit === 'A'
                    ? `, ${station.supplyPhases === 1 ? 'single' : 'three'}-phase`
                    : ''}
                </p>
                {station.failsafe.map((f) => (
                  <p key={f.evseNumber} className="text-xs">
                    Fallback{f.evseNumber > 0 ? ` (EVSE ${f.evseNumber})` : ''}:{' '}
                    {f.sentLimit !== null
                      ? `${f.sentLimit} ${f.sentUnit}`
                      : 'not set yet'}
                    {f.belowMinimum ? (
                      <span className="text-caution-ink">
                        {' '}
                        — its share of the lowest budget is under the{' '}
                        {status.policy?.minCurrentA ?? 6} A a car will take, so it
                        idles without us. Raise the budget, or take chargers off
                        the site.
                      </span>
                    ) : null}
                    {f.outcome && f.outcome !== 'answered:Accepted' ? (
                      <span className="text-caution-ink" title={f.detail ?? undefined}>
                        {' '}
                        — last attempt {f.outcome.replace('answered:', '').replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">
          A charger’s rating, and whether it takes limits in amps or watts, are
          set on the charger’s Settings tab.
        </p>
      </CardContent>
    </Card>
  );
}

interface WindowDraft {
  key: number;
  from: string;
  to: string;
  days: number[];
  limitKw: string;
}

let nextKey = 1;

function PolicyCard({
  siteId,
  status,
  hasZone,
}: {
  siteId: string;
  status: LoadStatus;
  hasZone: boolean;
}) {
  const canAdmin = useCan('admin');
  const policy = status.policy;
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  const [capacityKw, setCapacityKw] = useState(
    policy ? String(policy.capacityW / 1000) : '',
  );
  const [strategy, setStrategy] = useState<'equal' | 'fifo'>(
    policy?.strategy ?? 'equal',
  );
  const [minCurrent, setMinCurrent] = useState(
    String(policy?.minCurrentA ?? 6),
  );
  const [voltage, setVoltage] = useState(String(policy?.voltageV ?? 230));
  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    (policy?.windows ?? []).map((w: LoadWindow) => ({
      key: nextKey++,
      from: w.from,
      to: w.to,
      days: w.days ?? [],
      limitKw: String(w.limitW / 1000),
    })),
  );

  const problems: string[] = [];
  const capacity = Number(capacityKw);
  if (!(capacity > 0)) problems.push('The site capacity is a number of kW above zero.');
  const minA = Number(minCurrent);
  if (!(minA >= 0 && minA <= 80)) problems.push('The minimum current is 0 to 80 A.');
  const volts = Number(voltage);
  if (!(Number.isInteger(volts) && volts >= 100 && volts <= 480)) {
    problems.push('The voltage is a whole number from 100 to 480.');
  }
  for (const w of windows) {
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(w.from) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(w.to)) {
      problems.push('Each window needs a start and end time.');
      break;
    }
    if (!(Number(w.limitKw) >= 0) || w.limitKw.trim() === '') {
      problems.push('Each window needs a limit in kW.');
      break;
    }
  }

  const save = useMutation({
    mutationFn: () =>
      apiSend<LoadStatus>('PUT', `/locations/${siteId}/load-management`, {
        enabled,
        capacityW: Math.round(capacity * 1000),
        strategy,
        minCurrentA: minA,
        voltageV: volts,
        windows: windows.map((w) => ({
          from: w.from,
          to: w.to,
          ...(w.days.length > 0 ? { days: w.days } : {}),
          limitW: Math.round(Number(w.limitKw) * 1000),
        })),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['site', siteId, 'load'], saved);
      // The balancer runs right after the save; show what it did.
      setTimeout(
        () =>
          void queryClient.invalidateQueries({
            queryKey: ['site', siteId, 'load'],
          }),
        2_000,
      );
      toast.success(
        enabled ? 'Saved. Rebalancing the site now.' : 'Saved. Load management is off.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const minKw3 = ((minA || 0) * (volts || 0) * 3) / 1000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={!canAdmin} className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              Share this site’s power between sessions
              <span className="text-muted-foreground block text-xs">
                Switching it off removes the limits it set on the chargers.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="capacity">Site capacity (kW)</Label>
            <Input
              id="capacity"
              value={capacityKw}
              onChange={(event) => setCapacityKw(event.target.value)}
              placeholder="50"
              inputMode="decimal"
            />
            <p className="text-muted-foreground text-xs">
              What all the chargers here may draw together: the sanctioned
              load or feeder rating, less what the rest of the site needs.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Sharing</Label>
            <Select
              value={strategy}
              items={STRATEGY_ITEMS}
              onValueChange={(value) =>
                setStrategy(value === 'fifo' ? 'fifo' : 'equal')
              }
            >
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min-current">Minimum per session (A)</Label>
              <Input
                id="min-current"
                value={minCurrent}
                onChange={(event) => setMinCurrent(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voltage">Voltage (phase to neutral)</Label>
              <Input
                id="voltage"
                value={voltage}
                onChange={(event) => setVoltage(event.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            A car needs at least 6 A to charge at all. When there is not
            enough for every session to get its minimum (
            {minKw3.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kW
            on three phases), the latest arrivals wait instead of everyone
            crawling.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Time-of-day limits</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setWindows((current) => [
                    ...current,
                    {
                      key: nextKey++,
                      from: '18:00',
                      to: '22:00',
                      days: [],
                      limitKw: '',
                    },
                  ])
                }
              >
                <PlusIcon />
                Add window
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              A lower budget at certain hours — the evening peak your
              electricity board charges more for, or when the building needs
              its power back. Where windows overlap, the lowest applies.
              {hasZone
                ? ''
                : ' This site has no time zone, so the lowest window applies all day until one is set.'}
            </p>
            {windows.map((w) => (
              <div key={w.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="time"
                      value={w.from}
                      className="w-32"
                      onChange={(event) =>
                        setWindows((current) =>
                          current.map((x) =>
                            x.key === w.key ? { ...x, from: event.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="time"
                      value={w.to}
                      className="w-32"
                      onChange={(event) =>
                        setWindows((current) =>
                          current.map((x) =>
                            x.key === w.key ? { ...x, to: event.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Limit (kW)</Label>
                    <Input
                      value={w.limitKw}
                      className="w-24"
                      inputMode="decimal"
                      onChange={(event) =>
                        setWindows((current) =>
                          current.map((x) =>
                            x.key === w.key
                              ? { ...x, limitKw: event.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove window"
                    onClick={() =>
                      setWindows((current) =>
                        current.filter((x) => x.key !== w.key),
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((day, index) => {
                    const iso = index + 1;
                    const on = w.days.includes(iso);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setWindows((current) =>
                            current.map((x) =>
                              x.key === w.key
                                ? {
                                    ...x,
                                    days: on
                                      ? x.days.filter((d) => d !== iso)
                                      : [...x.days, iso].sort(),
                                  }
                                : x,
                            ),
                          )
                        }
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs',
                          on
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                  <span className="text-muted-foreground self-center pl-1 text-xs">
                    {w.days.length === 0 ? 'Every day' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {problems.length > 0 && canAdmin ? (
            <ul className="text-destructive space-y-1 text-xs">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </fieldset>

        {canAdmin ? (
          <Button
            onClick={() => save.mutate()}
            disabled={problems.length > 0 || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Only an administrator can change these.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
