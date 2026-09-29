'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
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
import type { FreeChargingGrant, IdToken } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { FreeChargingBadge } from './badges';
import { toExpiryIso } from './expiry';

/**
 * Free charging on one card (`charveta` doc 6 §22.4, "Card taps and free
 * charging").
 *
 * The owner's rule is that a free session is never free to the business: it
 * is charged to whoever granted it, until an owner makes the company pay. So
 * this always says who is paying, not only that the card is free.
 *
 * An admin grants and revokes; only an owner moves the cost onto the company.
 * The API enforces both — the buttons here only hide what would be refused.
 */
export function FreeChargingCard({ card }: { card: IdToken }) {
  const canAdmin = useCan('admin');
  const canOwn = useCan('owner');
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ['card', card.id, 'free-charging'],
    queryFn: () =>
      apiGet<FreeChargingGrant[]>(`/id-tokens/${card.id}/free-charging`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
    void queryClient.invalidateQueries({ queryKey: ['cards'] });
  };

  const change = useMutation({
    mutationFn: (action: 'revoke' | 'sponsor' | 'unsponsor') =>
      apiSend<FreeChargingGrant>(
        action === 'sponsor' ? 'PUT' : 'DELETE',
        action === 'revoke'
          ? `/id-tokens/${card.id}/free-charging`
          : `/id-tokens/${card.id}/free-charging/company-sponsored`,
      ),
    onSuccess: (_grant, action) => {
      refresh();
      toast.success(
        action === 'revoke'
          ? 'Free charging ended.'
          : action === 'sponsor'
            ? 'The company pays for this card’s free sessions from now on.'
            : 'The grantor pays for this card’s free sessions from now on.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = card.freeCharging ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Free charging
            {current?.active ? (
              <FreeChargingBadge company={current.companySponsored} />
            ) : null}
          </CardTitle>
          <CardDescription>
            A free session costs the driver nothing. Its full price is charged
            to the person who granted it, until an owner makes the company pay.
            Without free charging, a card with driver payments on is accepted
            only if a fleet pays for it or its driver’s wallet can.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdmin && !current?.active ? (
            <GrantDialog card={card} onGranted={refresh} />
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
              End free charging
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {current ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Fact label="Reason" value={current.reason} />
            <Fact
              label="Granted by"
              value={`${current.grantedBy.email ?? 'a former user'} · ${dateTime(current.grantedAt)}`}
            />
            <Fact
              label="Ends"
              value={
                current.expiresAt
                  ? `${dateTime(current.expiresAt)}${current.active ? '' : ' (ended)'}`
                  : 'When revoked'
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
        ) : (
          <p className="text-muted-foreground text-sm">
            This card does not charge for free.
          </p>
        )}

        {history.isPending ? <Loading rows={1} /> : null}
        {history.isError ? <Failed error={history.error} /> : null}
        {history.isSuccess && history.data.some((g) => g.revokedAt) ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Earlier</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {history.data
                .filter((grant) => grant.revokedAt)
                .map((grant) => (
                  <li key={grant.id}>
                    {dateTime(grant.grantedAt)} – {dateTime(grant.revokedAt)}:{' '}
                    {grant.reason}, granted by{' '}
                    {grant.grantedBy.email ?? 'a former user'}
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
  card,
  onGranted,
}: {
  card: IdToken;
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
        `/id-tokens/${card.id}/free-charging`,
        { reason: reason.trim(), ...(expiresAt ? { expiresAt } : {}) },
      );
    },
    onSuccess: () => {
      onGranted();
      setOpen(false);
      setReason('');
      setUntilDay('');
      toast.success(`${card.token} charges for free, at your cost.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Grant free charging
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Free charging on {card.token}</DialogTitle>
          <DialogDescription>
            The driver pays nothing. The full price of every session is charged
            to you, as the person granting it, until an owner makes the company
            pay for it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="free-reason">Reason</Label>
            <Input
              id="free-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Site host"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="free-until">Until (optional)</Label>
            <Input
              id="free-until"
              type="date"
              value={untilDay}
              onChange={(event) => setUntilDay(event.target.value)}
              className="w-48"
            />
            <p className="text-muted-foreground text-xs">
              Free to the end of that day. Leave it empty to keep it until it
              is ended here.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => grant.mutate()}
            disabled={grant.isPending || reason.trim() === ''}
          >
            {grant.isPending ? 'Granting…' : 'Grant at my cost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
