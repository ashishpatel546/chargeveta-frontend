'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiSend } from '@/lib/api/client';
import type {
  ChargerPaymentSettings,
  FreeChargingGrant,
  Station,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { toExpiryIso } from '../../cards/expiry';

/**
 * Who pays for a session at this charger when nobody presents a card
 * (`charveta` doc 6 §22.4, "Sessions with no card").
 *
 * With driver payments on, a start button (or a charger with its card check
 * off) has no driver to charge, so it is refused unless the station is
 * operator-paid — and then, like free charging on a card, the person who made
 * it so pays, until an owner makes the company pay. The charger is also kept
 * set so it cannot start such a session by itself; the second card says
 * whether it took those settings.
 */
export function PaymentsPanel({ station }: { station: Station }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OperatorPaid station={station} />
      <ChargerSettings station={station} />
    </div>
  );
}

function OperatorPaid({ station }: { station: Station }) {
  const canAdmin = useCan('admin');
  const canOwn = useCan('owner');
  const queryClient = useQueryClient();
  const key = ['station', station.id, 'operator-paid'];
  const history = useQuery({
    queryKey: key,
    queryFn: () =>
      apiGet<FreeChargingGrant[]>(`/stations/${station.id}/operator-paid`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({
      queryKey: ['station', station.id, 'payment-settings'],
    });
  };

  const change = useMutation({
    mutationFn: (action: 'revoke' | 'sponsor' | 'unsponsor') =>
      apiSend<FreeChargingGrant>(
        action === 'sponsor' ? 'PUT' : 'DELETE',
        action === 'revoke'
          ? `/stations/${station.id}/operator-paid`
          : `/stations/${station.id}/operator-paid/company-sponsored`,
      ),
    onSuccess: (_grant, action) => {
      refresh();
      toast.success(
        action === 'revoke'
          ? 'The start button is refused from now on.'
          : action === 'sponsor'
            ? 'The company pays for this charger’s start-button sessions from now on.'
            : 'The grantor pays for this charger’s start-button sessions from now on.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current =
    history.data?.find((grant) => grant.revokedAt === null) ?? null;
  const earlier = history.data?.filter((grant) => grant.revokedAt) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Start button
            {current?.active ? (
              <Badge variant="secondary">
                {current.companySponsored ? 'Company pays' : 'Operator-paid'}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            A session started with the charger’s button, or with no card, has
            no driver to charge. With driver payments on it is refused, unless
            this charger is operator-paid: then its full price is charged to the
            person who turned it on, until an owner makes the company pay.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdmin && !current?.active ? (
            <GrantDialog station={station} onGranted={refresh} />
          ) : null}
          {canOwn && current ? (
            <Button
              variant="outline"
              size="sm"
              disabled={change.isPending}
              onClick={() =>
                change.mutate(current.companySponsored ? 'unsponsor' : 'sponsor')
              }
            >
              {current.companySponsored
                ? 'Charge the grantor instead'
                : 'Company pays'}
            </Button>
          ) : null}
          {canAdmin && current ? (
            <Button
              variant="outline"
              size="sm"
              disabled={change.isPending}
              onClick={() => change.mutate('revoke')}
            >
              Refuse the start button
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.isPending ? <Loading rows={2} /> : null}
        {history.isError ? <Failed error={history.error} /> : null}
        {history.isSuccess && current ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm">
            <Fact label="Reason" value={current.reason} />
            <Fact
              label="Turned on by"
              value={`${current.grantedBy.email ?? 'a former user'} · ${dateTime(current.grantedAt)}`}
            />
            <Fact
              label="Ends"
              value={
                current.expiresAt
                  ? `${dateTime(current.expiresAt)}${current.active ? '' : ' (ended)'}`
                  : 'When turned off'
              }
            />
            <Fact
              label="Paid for by"
              value={
                current.companySponsored
                  ? `The company, since ${dateTime(current.companySponsoredAt)} (${current.companySponsoredBy?.email ?? 'an owner'})`
                  : (current.grantedBy.email ?? 'The grantor')
              }
            />
          </dl>
        ) : null}
        {history.isSuccess && !current ? (
          <p className="text-muted-foreground text-sm">
            Not operator-paid: a session needs a card or the driver app, so
            somebody pays for it.
          </p>
        ) : null}
        {earlier.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Earlier</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {earlier.map((grant) => (
                <li key={grant.id}>
                  {dateTime(grant.grantedAt)} – {dateTime(grant.revokedAt)}:{' '}
                  {grant.reason}, by {grant.grantedBy.email ?? 'a former user'}
                  {grant.revokedBy?.email
                    ? `, ended by ${grant.revokedBy.email}`
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GrantDialog({
  station,
  onGranted,
}: {
  station: Station;
  onGranted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [untilDay, setUntilDay] = useState('');

  const grant = useMutation({
    mutationFn: () => {
      const expiresAt = toExpiryIso(untilDay);
      return apiSend<FreeChargingGrant>(
        'POST',
        `/stations/${station.id}/operator-paid`,
        { reason: reason.trim(), ...(expiresAt ? { expiresAt } : {}) },
      );
    },
    onSuccess: () => {
      onGranted();
      setOpen(false);
      setReason('');
      setUntilDay('');
      toast.success(
        `${station.identity}’s start button may charge, at your cost.`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Make operator-paid
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Let {station.identity}’s start button charge</DialogTitle>
          <DialogDescription>
            Nobody presents a card, so no driver pays. The full price of every
            such session is charged to you, as the person turning this on, until
            an owner makes the company pay for it. Use it for depot, staff or
            demo chargers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operator-paid-reason">Reason</Label>
            <Input
              id="operator-paid-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Depot charger for staff vehicles"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operator-paid-until">Until (optional)</Label>
            <Input
              id="operator-paid-until"
              type="date"
              value={untilDay}
              onChange={(event) => setUntilDay(event.target.value)}
              className="w-48"
            />
            <p className="text-muted-foreground text-xs">
              To the end of that day. Leave it empty to keep it until it is
              turned off here.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => grant.mutate()}
            disabled={grant.isPending || reason.trim() === ''}
          >
            {grant.isPending ? 'Turning on…' : 'Turn on at my cost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATE_LABEL: Record<ChargerPaymentSettings['state'], string> = {
  applied: 'In place',
  refused: 'Refused',
  pending: 'Not confirmed yet',
};

function ChargerSettings({ station }: { station: Station }) {
  const canOperate = useCan('operator');
  const queryClient = useQueryClient();
  const key = ['station', station.id, 'payment-settings'];
  const settings = useQuery({
    queryKey: key,
    queryFn: () =>
      apiGet<ChargerPaymentSettings>(
        `/stations/${station.id}/payment-settings`,
      ),
  });

  const resend = useMutation({
    mutationFn: () =>
      apiSend<ChargerPaymentSettings>(
        'POST',
        `/stations/${station.id}/payment-settings/resend`,
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      toast.success('The charger is sent its payment settings on the next pass.');
      // The sweep runs every few seconds; show its answer when it lands.
      for (const ms of [5_000, 15_000]) {
        setTimeout(
          () => void queryClient.invalidateQueries({ queryKey: key }),
          ms,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = settings.data;
  const answerFor = (name: string) =>
    data?.answers.find((answer) => answer.name === name);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Payment settings on the charger
            {data?.paymentsEnabled ? (
              <Badge
                variant={
                  data.state === 'refused'
                    ? 'destructive'
                    : data.state === 'applied'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {STATE_LABEL[data.state]}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Kept on the charger so it cannot start, or carry on, a session
            nobody pays for. Sent after every reboot and configuration change,
            and once a day. A session that gets through anyway is stopped and
            you are alerted.
          </CardDescription>
        </div>
        {canOperate && data?.paymentsEnabled ? (
          <Button
            variant="outline"
            size="sm"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            Send again
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.isPending ? <Loading rows={3} /> : null}
        {settings.isError ? <Failed error={settings.error} /> : null}
        {data && !data.paymentsEnabled ? (
          <p className="text-muted-foreground text-sm">
            Driver payments are off, so nothing is sent: the charger is left as
            it is.
          </p>
        ) : null}
        {data?.paymentsEnabled ? (
          <>
            <ul className="space-y-1 text-sm">
              {data.wanted.map((setting) => {
                const answer = answerFor(setting.name);
                return (
                  <li
                    key={setting.name}
                    className="flex flex-wrap justify-between gap-2 border-b pb-1"
                  >
                    <span>
                      <span className="font-mono text-xs">{setting.name}</span>{' '}
                      = <span className="font-mono text-xs">{setting.value}</span>
                      {setting.required ? null : (
                        <span className="text-muted-foreground text-xs">
                          {' '}
                          (optional)
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        answer && !answer.ok
                          ? 'text-destructive text-xs font-medium'
                          : 'text-muted-foreground text-xs'
                      }
                    >
                      {answer?.status ?? '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {data.operatorPaid ? (
              <p className="text-muted-foreground text-xs">
                Operator-paid: its own card check is left as it is, so the start
                button works.
              </p>
            ) : null}
            {data.detail ? (
              <p className="text-muted-foreground text-xs">{data.detail}</p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {data.appliedAt
                ? `Confirmed ${dateTime(data.appliedAt)}.`
                : data.sentAt
                  ? `Last sent ${dateTime(data.sentAt)}${data.outcome ? ` (${data.outcome})` : ''}.`
                  : 'Sent when the charger is next online.'}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
