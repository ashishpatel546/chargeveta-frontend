'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
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
import {
  MONITOR_TYPES,
  MONITORING_BASES,
  type CommandResult,
  type MonitorCommandResult,
  type MonitorType,
  type Station,
  type StationMonitor,
  type StationMonitoring,
} from '@/lib/api/types';
import { dateTime, since } from '@/lib/format';

/**
 * The monitors on a charger's device model (`charveta` doc 6 §13.6): rules
 * an OCPP 2.x charger applies to itself — "tell me when this changes", "tell
 * me when that goes above 80" — and reports as a device event when one fires.
 *
 * The list is what the charger last reported plus what was set here. It goes
 * stale on its own (a charger adds monitors, a base change removes some), so
 * the age is shown and a refresh is one button away. A refresh answers only
 * "I will send it"; the list itself arrives a moment later through the event
 * worker, so the panel polls briefly after asking.
 *
 * 1.6 has no device model, and says so rather than showing an empty list.
 */
export function MonitoringPanel({ station }: { station: Station }) {
  const canOperate = useCan('operator');
  const queryClient = useQueryClient();
  // Set after a refresh is accepted: poll while the report arrives.
  const [awaitingSince, setAwaitingSince] = useState<number | null>(null);

  const monitoring = useQuery({
    queryKey: ['station', station.id, 'monitors'],
    queryFn: () =>
      apiGet<StationMonitoring>(`/stations/${station.id}/monitors`),
    refetchInterval: () =>
      awaitingSince !== null && Date.now() - awaitingSince < 20_000
        ? 2_000
        : false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['station', station.id] });

  const refresh = useMutation({
    mutationFn: () =>
      apiSend<CommandResult>(
        'POST',
        `/stations/${station.id}/monitors/refresh`,
      ),
    onSuccess: (answer) => {
      void invalidate();
      if (answer.outcome !== 'answered') {
        toast.warning(`The charger did not answer: ${answer.outcome}`);
      } else if (answer.status === 'Accepted') {
        setAwaitingSince(Date.now());
        toast.success('The charger is sending its monitors.');
      } else if (answer.status === 'EmptyResultSet') {
        toast.success('The charger has no monitors.');
      } else {
        toast.warning(`The charger answered ${answer.status ?? 'nothing'}.`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (monitoring.isPending) return <Loading rows={4} />;
  if (monitoring.isError) return <Failed error={monitoring.error} />;

  const data = monitoring.data;
  if (!data.supported) {
    return (
      <Empty>
        This charger speaks OCPP {data.ocppVersion}, which has no device model
        and so no monitoring. It reports its faults on its connector status
        instead. Monitors exist on OCPP 2.0.1 and 2.1.
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto text-base">Monitors</CardTitle>
          <span className="text-muted-foreground text-xs">
            {data.lastReportedAt
              ? `Last reported ${since(data.lastReportedAt)}`
              : 'Never reported by the charger'}
          </span>
          {canOperate ? (
            <Button
              variant="outline"
              size="sm"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              {refresh.isPending ? 'Asking…' : 'Refresh from charger'}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {data.monitors.length === 0 ? (
            <Empty>
              No monitors known. Refresh to ask the charger which it has.
            </Empty>
          ) : (
            <MonitorTable
              station={station}
              monitors={data.monitors}
              canOperate={canOperate}
            />
          )}
        </CardContent>
      </Card>

      {canOperate ? (
        <>
          <AddMonitorCard station={station} />
          <SettingsCard
            station={station}
            monitoring={data}
            onBaseAccepted={() => refresh.mutate()}
          />
        </>
      ) : null}
    </div>
  );
}

/** The OCPP severity scale, 0 to 9, in the specification's own words. */
const SEVERITIES = [
  'Danger',
  'Hardware failure',
  'System failure',
  'Critical',
  'Error',
  'Alert',
  'Warning',
  'Notice',
  'Informational',
  'Debug',
];

const severityLabel = (severity: number) =>
  `${severity} · ${SEVERITIES[severity] ?? '?'}`;

/** `Connector[inst] (EVSE 1 · 2) . AvailabilityState[inst]` */
function watches(monitor: StationMonitor) {
  const component = monitor.componentInstance
    ? `${monitor.componentName}[${monitor.componentInstance}]`
    : monitor.componentName;
  const variable = monitor.variableInstance
    ? `${monitor.variableName}[${monitor.variableInstance}]`
    : monitor.variableName;
  const where =
    monitor.evseNumber === 0
      ? 'station'
      : monitor.connectorNumber === 0
        ? `EVSE ${monitor.evseNumber}`
        : `EVSE ${monitor.evseNumber} · connector ${monitor.connectorNumber}`;
  return { name: `${component}.${variable}`, where };
}

/** What a monitor's value means, by its type. */
function rule(monitor: StationMonitor): string {
  switch (monitor.type) {
    case 'UpperThreshold':
      return `above ${monitor.value}`;
    case 'LowerThreshold':
      return `below ${monitor.value}`;
    case 'Delta':
      return monitor.value === 0 ? 'any change' : `changes by ${monitor.value}`;
    case 'Periodic':
      return `every ${monitor.value}s`;
    case 'PeriodicClockAligned':
      return `every ${monitor.value}s, on the clock`;
    default:
      return `${monitor.type} ${monitor.value}`;
  }
}

function MonitorTable({
  station,
  monitors,
  canOperate,
}: {
  station: Station;
  monitors: StationMonitor[];
  canOperate: boolean;
}) {
  const queryClient = useQueryClient();
  const clear = useMutation({
    mutationFn: (monitorId: number) =>
      apiSend<MonitorCommandResult>(
        'DELETE',
        `/stations/${station.id}/monitors/${monitorId}`,
      ),
    onSuccess: (answer, monitorId) => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      if (answer.outcome !== 'answered') {
        toast.warning(`The charger did not answer: ${answer.outcome}`);
      } else if (answer.monitorStatus === 'Accepted') {
        toast.success(`Monitor ${monitorId} cleared.`);
      } else if (answer.monitorStatus === 'NotFound') {
        toast.success(
          `The charger had no monitor ${monitorId}; it is off the list.`,
        );
      } else {
        toast.warning(
          `The charger answered ${answer.monitorStatus ?? 'nothing'} — ` +
            'a hard-wired monitor usually cannot be cleared.',
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Id</TableHead>
            <TableHead>Watches</TableHead>
            <TableHead>Reports</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Made by</TableHead>
            {canOperate ? <TableHead className="text-right" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {monitors.map((monitor) => {
            const target = watches(monitor);
            return (
              <TableRow key={monitor.monitorId}>
                <TableCell className="font-mono text-xs">
                  {monitor.monitorId}
                </TableCell>
                <TableCell className="text-sm">
                  <span className="font-mono text-xs">{target.name}</span>
                  <p className="text-muted-foreground text-xs">
                    {target.where}
                  </p>
                </TableCell>
                <TableCell className="text-sm">
                  {rule(monitor)}
                  {monitor.transaction ? (
                    <p className="text-muted-foreground text-xs">
                      only during a session
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {severityLabel(monitor.severity)}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge
                    variant={monitor.origin === 'csms' ? 'secondary' : 'outline'}
                    title={
                      monitor.setAt
                        ? `Set ${dateTime(monitor.setAt)} by ${monitor.setBy ?? '?'}`
                        : undefined
                    }
                  >
                    {monitor.origin === 'csms' ? 'set here' : 'charger'}
                  </Badge>
                  {monitor.notificationType ? (
                    <p className="text-muted-foreground text-xs">
                      {monitor.notificationType}
                    </p>
                  ) : null}
                </TableCell>
                {canOperate ? (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={clear.isPending}
                      onClick={() => clear.mutate(monitor.monitorId)}
                    >
                      Clear
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const TYPE_HELP: Record<MonitorType, string> = {
  UpperThreshold: 'Fires when the value rises above the threshold.',
  LowerThreshold: 'Fires when the value falls below the threshold.',
  Delta:
    'Fires when the value changes by at least this much — 0 for any change, and any change for a variable that is not a number.',
  Periodic: 'Reports the value every this many seconds.',
  PeriodicClockAligned:
    'Reports every this many seconds, aligned to the clock (900 is on the quarter hour).',
  TargetDelta: 'OCPP 2.1 only: fires when the value departs from its target.',
  TargetDeltaRelative:
    'OCPP 2.1 only: the same, as a percentage of the target.',
};

/** Setting one monitor, by component and variable, as the charger names them. */
function AddMonitorCard({ station }: { station: Station }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    componentName: '',
    componentInstance: '',
    evseId: '',
    connectorId: '',
    variableName: '',
    variableInstance: '',
    type: 'Delta' as MonitorType,
    value: '0',
    severity: '5',
    transaction: 'no',
    replaces: '',
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const update = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const types = MONITOR_TYPES.filter(
    (type) =>
      station.ocppVersion === '2.1' ||
      (type !== 'TargetDelta' && type !== 'TargetDeltaRelative'),
  );

  const set = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<MonitorCommandResult>(
        'POST',
        `/stations/${station.id}/monitors`,
        body,
      ),
    onSuccess: (answer) => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      if (answer.outcome !== 'answered') {
        toast.warning(
          `The charger did not answer: ${answer.outcome}` +
            (answer.detail ? ` — ${answer.detail}` : ''),
        );
      } else if (answer.monitorStatus === 'Accepted' && answer.monitor) {
        toast.success(`Monitor ${answer.monitor.monitorId} set.`);
      } else {
        toast.warning(
          `The charger answered ${answer.monitorStatus ?? 'nothing'}` +
            (answer.reasonCode ? ` (${answer.reasonCode})` : '') +
            '; nothing was set.',
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const integer = (raw: string) => {
    const value = Number(raw);
    return raw.trim() !== '' && Number.isInteger(value) ? value : undefined;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(form.value);
    if (!form.componentName.trim() || !form.variableName.trim()) {
      setInvalid('A component and a variable are needed.');
      return;
    }
    if (form.value.trim() === '' || !Number.isFinite(value)) {
      setInvalid('The value must be a number.');
      return;
    }
    const evseId = integer(form.evseId);
    const connectorId = integer(form.connectorId);
    if (form.connectorId.trim() && evseId === undefined) {
      setInvalid('A connector is addressed within an EVSE; give the EVSE too.');
      return;
    }
    setInvalid(null);
    set.mutate({
      component: {
        name: form.componentName.trim(),
        ...(form.componentInstance.trim()
          ? { instance: form.componentInstance.trim() }
          : {}),
        ...(evseId !== undefined
          ? {
              evse: {
                id: evseId,
                ...(connectorId !== undefined ? { connectorId } : {}),
              },
            }
          : {}),
      },
      variable: {
        name: form.variableName.trim(),
        ...(form.variableInstance.trim()
          ? { instance: form.variableInstance.trim() }
          : {}),
      },
      type: form.type,
      value,
      severity: Number(form.severity),
      ...(form.transaction === 'yes' ? { transaction: true } : {}),
      ...(integer(form.replaces) !== undefined
        ? { replaces: integer(form.replaces) }
        : {}),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a monitor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            The component and variable are the charger’s own names — a device
            model report says which variables it can monitor. The charger
            assigns the monitor’s id when it accepts.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              id="mon-component"
              label="Component"
              placeholder="Connector"
              value={form.componentName}
              onChange={update('componentName')}
            />
            <TextField
              id="mon-component-instance"
              label="Component instance (optional)"
              value={form.componentInstance}
              onChange={update('componentInstance')}
            />
            <TextField
              id="mon-evse"
              label="EVSE (optional)"
              placeholder="1"
              value={form.evseId}
              onChange={update('evseId')}
              type="number"
            />
            <TextField
              id="mon-connector"
              label="Connector (optional)"
              placeholder="1"
              value={form.connectorId}
              onChange={update('connectorId')}
              type="number"
            />
            <TextField
              id="mon-variable"
              label="Variable"
              placeholder="AvailabilityState"
              value={form.variableName}
              onChange={update('variableName')}
            />
            <TextField
              id="mon-variable-instance"
              label="Variable instance (optional)"
              value={form.variableInstance}
              onChange={update('variableInstance')}
            />
            <div className="space-y-1">
              <Label htmlFor="mon-type" className="text-xs">
                Type
              </Label>
              <Select
                value={form.type}
                onValueChange={(next) => update('type')(next ?? 'Delta')}
              >
                <SelectTrigger id="mon-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TextField
              id="mon-value"
              label="Value"
              value={form.value}
              onChange={update('value')}
              type="number"
            />
            <SeveritySelect
              id="mon-severity"
              value={form.severity}
              onChange={update('severity')}
            />
            <div className="space-y-1">
              <Label htmlFor="mon-transaction" className="text-xs">
                Only during a session
              </Label>
              <Select
                value={form.transaction}
                onValueChange={(next) => update('transaction')(next ?? 'no')}
              >
                <SelectTrigger id="mon-transaction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TextField
              id="mon-replaces"
              label="Replaces monitor id (optional)"
              value={form.replaces}
              onChange={update('replaces')}
              type="number"
            />
          </div>
          <p className="text-muted-foreground text-xs">{TYPE_HELP[form.type]}</p>
          {invalid ? <p className="text-destructive text-sm">{invalid}</p> : null}
          <Button type="submit" disabled={set.isPending}>
            {set.isPending ? 'Sending…' : 'Set monitor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** The monitoring level and base: which events are reported, which monitors run. */
function SettingsCard({
  station,
  monitoring,
  onBaseAccepted,
}: {
  station: Station;
  monitoring: StationMonitoring;
  onBaseAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(String(monitoring.level?.value ?? 9));
  const [base, setBase] = useState(monitoring.base?.value ?? 'All');

  const send = useMutation({
    mutationFn: (request: { path: string; body: Record<string, unknown> }) =>
      apiSend<CommandResult>(
        'POST',
        `/stations/${station.id}/${request.path}`,
        request.body,
      ),
    onSuccess: (answer, request) => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      if (answer.outcome !== 'answered') {
        toast.warning(`The charger did not answer: ${answer.outcome}`);
        return;
      }
      if (answer.status !== 'Accepted') {
        toast.warning(`The charger answered ${answer.status ?? 'nothing'}.`);
        return;
      }
      toast.success('The charger accepted it.');
      // What a base change did to the charger's monitors is its to say.
      if (request.path === 'monitoring-base') onBaseAccepted();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What the charger reports</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <SeveritySelect
            id="mon-level"
            label="Monitoring level"
            value={level}
            onChange={setLevel}
          />
          <p className="text-muted-foreground text-xs">
            Only events this severe or more (a lower number) are reported.{' '}
            {monitoring.level
              ? `Last accepted: ${severityLabel(monitoring.level.value)}, ${since(monitoring.level.setAt)}.`
              : 'Never set from here.'}
          </p>
          <Button
            variant="outline"
            disabled={send.isPending}
            onClick={() =>
              send.mutate({
                path: 'monitoring-level',
                body: { severity: Number(level) },
              })
            }
          >
            Set level
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mon-base" className="text-xs">
            Monitoring base
          </Label>
          <Select value={base} onValueChange={(next) => setBase(next ?? 'All')}>
            <SelectTrigger id="mon-base" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONITORING_BASES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            All preconfigured monitors, the manufacturer’s default set, or only
            the hard-wired ones (which also clears custom monitors). The list is
            refreshed after the charger accepts.{' '}
            {monitoring.base
              ? `Last accepted: ${monitoring.base.value}, ${since(monitoring.base.setAt)}.`
              : 'Never set from here.'}
          </p>
          <Button
            variant="outline"
            disabled={send.isPending}
            onClick={() =>
              send.mutate({ path: 'monitoring-base', body: { base } })
            }
          >
            Set base
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SeveritySelect({
  id,
  label = 'Severity',
  value,
  onChange,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? '9')}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SEVERITIES.map((_, severity) => (
            <SelectItem key={severity} value={String(severity)}>
              {severityLabel(severity)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
