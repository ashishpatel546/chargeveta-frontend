'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  COMMANDS,
  fieldsFor,
  type CommandField,
  type CommandSpec,
} from './command-catalogue';
import { usePrincipal } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { OutcomeBadge } from '@/components/status-badge';
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
  atLeast,
  type CommandResult,
  type Station,
  type StationCommandEntry,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';

/**
 * Sending a charger a command, and seeing what it said.
 *
 * Every one of these answers 200 whatever happened — the charger's refusal, a
 * timeout, the charger being offline — so the outcome is read from the body,
 * never from the status code. The distinction that matters operationally is
 * `delivered`: a command that reached the charger and then timed out may still
 * have been carried out, and sending it again could do it twice.
 */
export function CommandsPanel({ station }: { station: Station }) {
  const principal = usePrincipal();
  const [selected, setSelected] = useState<string>(COMMANDS[0].id);
  const [result, setResult] = useState<CommandResult | null>(null);
  const queryClient = useQueryClient();

  const available = COMMANDS.filter(
    (command) =>
      atLeast(principal.role, command.needs) &&
      (!command.versions || command.versions.includes(station.ocppVersion)),
  );
  const spec = available.find((command) => command.id === selected);

  const history = useQuery({
    queryKey: ['station', station.id, 'commands'],
    queryFn: () =>
      apiGet<StationCommandEntry[]>(`/stations/${station.id}/commands`),
  });

  const send = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<CommandResult>(
        'POST',
        `/stations/${station.id}/commands/${selected}`,
        Object.keys(body).length === 0 ? {} : body,
      ),
    onSuccess: (answer) => {
      setResult(answer);
      void queryClient.invalidateQueries({
        queryKey: ['station', station.id],
      });
      if (answer.outcome === 'answered') {
        toast.success(`The charger answered ${answer.status ?? 'ok'}`);
      } else {
        toast.warning(`The charger did not answer: ${answer.outcome}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (available.length === 0) {
    return <Empty>Your role cannot send commands to a charger.</Empty>;
  }

  return (
    <div className="space-y-6">
      {atLeast(principal.role, 'operator') ? (
        <LocalListCard station={station} />
      ) : null}
      {atLeast(principal.role, 'operator') && station.ocppVersion === '2.1' ? (
        <TariffCard station={station} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send a command</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="command">Command</Label>
            <Select
              value={selected}
              onValueChange={(value) => {
                setSelected(value ?? COMMANDS[0].id);
                setResult(null);
              }}
            >
              <SelectTrigger id="command" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((command) => (
                  <SelectItem key={command.id} value={command.id}>
                    {command.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {spec ? (
            <CommandForm
              key={spec.id}
              spec={spec}
              station={station}
              pending={send.isPending}
              onSend={(body) => send.mutate(body)}
            />
          ) : null}

          {result ? <Outcome result={result} /> : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium">What has been sent</h2>
        {history.isPending ? <Loading rows={3} /> : null}
        {history.isError ? <Failed error={history.error} /> : null}
        {history.isSuccess && history.data.length === 0 ? (
          <Empty>Nothing has been sent to this charger yet.</Empty>
        ) : null}
        {history.isSuccess && history.data.length > 0 ? (
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Charger said</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Took</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{entry.command}</TableCell>
                    <TableCell>
                      <OutcomeBadge outcome={entry.outcome} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.status ?? entry.detail ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {entry.actor}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.durationMs} ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface LocalListSyncResult {
  version: number;
  entries: number;
  updateType: 'full' | 'differential';
  command: CommandResult | null;
}

/**
 * The charger's offline card list (`charveta` doc 6 §17.9): what it decides
 * from when it cannot reach us. A sync sends only the cards that changed when
 * the charger still holds the version last sent, the whole list otherwise.
 */
function LocalListCard({ station }: { station: Station }) {
  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: (full: boolean) =>
      apiSend<LocalListSyncResult>(
        'POST',
        `/stations/${station.id}/local-list/sync${full ? '?full=true' : ''}`,
      ),
    onSuccess: (answer) => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      if (!answer.command) {
        toast.success('The charger’s list is already up to date.');
        return;
      }
      const what =
        answer.updateType === 'full'
          ? `the whole list (${answer.entries} cards)`
          : `${answer.entries} change${answer.entries === 1 ? '' : 's'}`;
      if (
        answer.command.outcome === 'answered' &&
        answer.command.status === 'Accepted'
      ) {
        toast.success(`Sent ${what}; the charger holds version ${answer.version}.`);
      } else {
        toast.warning(
          `Sent ${what}, but the charger answered ` +
            `${answer.command.status ?? answer.command.outcome}; its version is unchanged.`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Offline card list</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground mr-auto text-sm">
          {station.localListVersion > 0
            ? `Version ${station.localListVersion} sent and accepted.`
            : 'Never sent to this charger.'}{' '}
          What the charger decides from when it cannot reach us.
        </p>
        <Button disabled={sync.isPending} onClick={() => sync.mutate(false)}>
          {sync.isPending ? 'Sending…' : 'Sync'}
        </Button>
        <Button
          variant="outline"
          disabled={sync.isPending}
          onClick={() => sync.mutate(true)}
        >
          Send the whole list
        </Button>
      </CardContent>
    </Card>
  );
}

interface TariffAssignment {
  tariffId: string;
  tariffKind: string;
  validFrom?: string;
  evseIds?: number[];
}

/**
 * Our tariff on an OCPP 2.1 charger (`charveta` doc 6 §16.13.9): send the
 * station's current one as its default for every EVSE, read back what it
 * holds, or clear them. It is sent on its own after every boot and with
 * every accepted card; these are for checking and for putting it right.
 */
function TariffCard({ station }: { station: Station }) {
  const queryClient = useQueryClient();
  const [held, setHeld] = useState<TariffAssignment[] | null>(null);

  const run = useMutation({
    mutationFn: (name: 'send-tariff' | 'get-tariffs' | 'clear-tariffs') =>
      apiSend<CommandResult>(
        'POST',
        `/stations/${station.id}/commands/${name}`,
        name === 'clear-tariffs' ? {} : undefined,
      ).then((answer) => ({ name, answer })),
    onSuccess: ({ name, answer }) => {
      void queryClient.invalidateQueries({
        queryKey: ['station', station.id, 'commands'],
      });
      if (answer.outcome !== 'answered') {
        toast.warning(
          `The charger did not answer: ${answer.outcome}` +
            (answer.detail ? ` — ${answer.detail}` : ''),
        );
        return;
      }
      if (name === 'get-tariffs') {
        const list =
          (answer.data as { tariffAssignments?: TariffAssignment[] } | undefined)
            ?.tariffAssignments ?? [];
        setHeld(list);
        toast.success(
          list.length > 0
            ? `The charger holds ${list.length} tariff${list.length === 1 ? '' : 's'}.`
            : `The charger holds no tariff (${answer.status ?? 'no status'}).`,
        );
        return;
      }
      if (name === 'clear-tariffs') {
        setHeld(null);
        const results =
          (answer.data as { results?: { status: string }[] } | undefined)
            ?.results ?? [];
        toast.success(
          `Cleared: ${results.map((result) => result.status).join(', ') || 'done'}.`,
        );
        return;
      }
      if (answer.status === 'Accepted') {
        toast.success('The charger accepted the tariff.');
      } else {
        toast.warning(
          `The charger answered ${answer.status ?? 'no status'}` +
            (answer.reasonCode ? ` (${answer.reasonCode})` : ''),
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tariff on the charger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground mr-auto text-sm">
            {station.ocpp21SendTariff
              ? 'Sent after every restart and with every accepted card, so the charger can show the price.'
              : 'Sending our tariff is turned off for this charger (Settings).'}
          </p>
          <Button
            disabled={run.isPending || !station.ocpp21SendTariff}
            onClick={() => run.mutate('send-tariff')}
          >
            Send
          </Button>
          <Button
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate('get-tariffs')}
          >
            Read back
          </Button>
          <Button
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate('clear-tariffs')}
          >
            Clear
          </Button>
        </div>
        {held && held.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {held.map((entry) => (
              <li key={`${entry.tariffId}-${entry.tariffKind}`}>
                <span className="font-mono text-xs break-all">
                  {entry.tariffId}
                </span>{' '}
                <span className="text-muted-foreground">
                  {entry.tariffKind === 'DefaultTariff' ? 'default' : 'driver'}
                  {entry.evseIds
                    ? `, EVSE ${entry.evseIds.join(', ')}`
                    : ', every EVSE'}
                  {entry.validFrom ? `, from ${dateTime(entry.validFrom)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CommandForm({
  spec,
  station,
  pending,
  onSend,
}: {
  spec: CommandSpec;
  station: Station;
  pending: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const fields = fieldsFor(spec, station.ocppVersion);
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.name]?.trim();
      if (!raw) {
        if (field.required) {
          setInvalid(`${field.label} is needed.`);
          return;
        }
        continue;
      }
      const value = coerce(field, raw);
      if (value === undefined) {
        setInvalid(`${field.label} is not in a shape the charger will accept.`);
        return;
      }
      body[field.name] = value;
    }
    setInvalid(null);
    onSend(body);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-muted-foreground text-sm">{spec.description}</p>

      {fields.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={(value) =>
                setValues((current) => ({ ...current, [field.name]: value }))
              }
            />
          ))}
        </div>
      ) : null}

      {invalid ? <p className="text-destructive text-sm">{invalid}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : spec.label}
      </Button>
    </form>
  );
}

/**
 * Turns what was typed into what the API expects.
 *
 * Returns undefined when it cannot, which the form reports rather than sending
 * something the API will reject with a less helpful message.
 */
function coerce(field: CommandField, raw: string): unknown {
  switch (field.type) {
    case 'number': {
      const value = Number(raw);
      return Number.isInteger(value) ? value : undefined;
    }
    case 'datetime': {
      const at = new Date(raw);
      return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
    }
    case 'textarea': {
      // Two textareas hold JSON, one holds a list of keys, and the rest hold
      // prose such as a PEM block.
      if (field.name === 'variables') {
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      }
      if (field.name === 'keys') {
        return raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
      }
      return raw;
    }
    default:
      return raw;
  }
}

function Field({
  field,
  value,
  onChange,
}: {
  field: CommandField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.name}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {field.required ? '' : ' (optional)'}
      </Label>

      {field.type === 'select' ? (
        <Select value={value} onValueChange={(next) => onChange(next ?? '')}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-3"
        />
      ) : (
        <Input
          id={id}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'datetime'
                ? 'datetime-local'
                : 'text'
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.help ? (
        <p className="text-muted-foreground text-xs">{field.help}</p>
      ) : null}
    </div>
  );
}

function Outcome({ result }: { result: CommandResult }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={result.outcome} />
        {result.status ? (
          <span className="text-sm font-medium">{result.status}</span>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          {result.durationMs} ms
        </span>
      </div>

      {result.detail ? <p className="text-sm">{result.detail}</p> : null}

      {result.delivered === false ? (
        <p className="text-sm text-caution-ink">
          It never reached the charger, so it certainly did not happen. Sending
          it again is safe.
        </p>
      ) : null}
      {result.delivered === true && result.outcome === 'timeout' ? (
        <p className="text-sm text-caution-ink">
          The charger was given this and did not answer in time. It may have
          been carried out — check before sending it again.
        </p>
      ) : null}

      {result.data ? (
        <pre className="bg-muted max-h-80 overflow-auto rounded p-2 font-mono text-xs">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
