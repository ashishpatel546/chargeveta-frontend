'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiSend } from '@/lib/api/client';
import type { IdToken } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import {
  AuthorizationTable,
  DECISION_FILTERS,
  useAuthorizations,
} from '../authorizations';
import { CardStatusBadge } from '../badges';
import {
  BlockCardDialog,
  DeleteCardDialog,
  UnblockCardButton,
} from '../card-actions';
import { toDayInput, toExpiryIso } from '../expiry';

export function CardDetail({ id }: { id: string }) {
  const canAdmin = useCan('admin');
  const router = useRouter();

  const card = useQuery({
    queryKey: ['card', id],
    queryFn: () => apiGet<IdToken>(`/id-tokens/${id}`),
  });

  if (card.isPending) return <Loading />;
  if (card.isError) return <Failed error={card.error} />;

  return (
    <>
      <PageHeader
        title={card.data.token}
        description={card.data.label ?? 'No label'}
      >
        {canAdmin ? (
          <>
            {card.data.isBlocked ? (
              <UnblockCardButton card={card.data} size="default" />
            ) : (
              <BlockCardDialog card={card.data} size="default" />
            )}
            <DeleteCardDialog
              card={card.data}
              size="default"
              onDeleted={() => router.push('/cards')}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Card
              <CardStatusBadge status={card.data.status} />
            </CardTitle>
            <CardDescription>
              The status is worked out from these facts each time it is asked
              for, so it is the same answer the driver gets at the charger.
              {card.data.isBlocked && card.data.blockedReason
                ? ` Blocked: ${card.data.blockedReason}.`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Keyed on the card so a refetch while the form is open does not
                throw away what is being typed, but a different card does. */}
            <CardForm key={card.data.id} card={card.data} editable={canAdmin} />
          </CardContent>
        </Card>

        <History id={id} />
      </div>
    </>
  );
}

function CardForm({ card, editable }: { card: IdToken; editable: boolean }) {
  const [label, setLabel] = useState(card.label ?? '');
  const [tokenType, setTokenType] = useState(card.tokenType ?? '');
  const [expiryDay, setExpiryDay] = useState(toDayInput(card.expiresAt));
  const [groupId, setGroupId] = useState(card.groupId ?? '');
  const [priority, setPriority] = useState(
    card.chargingPriority === null ? '' : String(card.chargingPriority),
  );
  const queryClient = useQueryClient();

  const priorityNumber = priority.trim() === '' ? null : Number(priority);
  const priorityValid =
    priorityNumber === null ||
    (Number.isInteger(priorityNumber) &&
      priorityNumber >= -9 &&
      priorityNumber <= 9);

  const save = useMutation({
    mutationFn: () =>
      // Emptied fields go as null rather than being left out: leaving one out
      // means "unchanged" to a PATCH, which would make clearing a label or an
      // expiry impossible.
      apiSend<IdToken>('PATCH', `/id-tokens/${card.id}`, {
        label: label.trim() || null,
        tokenType: tokenType.trim() || null,
        expiresAt: toExpiryIso(expiryDay) ?? null,
        groupId: groupId.trim() || null,
        chargingPriority: priorityNumber,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
      void queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Card saved.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={!editable}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="token-type">Type</Label>
          <Input
            id="token-type"
            value={tokenType}
            onChange={(event) => setTokenType(event.target.value)}
            placeholder="ISO14443"
            spellCheck={false}
            disabled={!editable}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiry">Expires</Label>
          <Input
            id="expiry"
            type="date"
            value={expiryDay}
            onChange={(event) => setExpiryDay(event.target.value)}
            disabled={!editable}
          />
          <p className="text-muted-foreground text-xs">
            The card works to the end of that day. Empty means no end date.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group">Group</Label>
          <Input
            id="group"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            spellCheck={false}
            disabled={!editable}
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Charging priority</Label>
          <Input
            id="priority"
            type="number"
            min={-9}
            max={9}
            step={1}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            disabled={!editable}
            aria-invalid={!priorityValid}
          />
          <p className="text-muted-foreground text-xs">
            −9 to 9, OCPP 2.x only.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <Input
            id="token"
            value={card.token}
            readOnly
            disabled
            className="font-mono"
          />
          <p className="text-muted-foreground text-xs">
            Never changes. A card with a new number is a new card, and this one
            gets blocked.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Added {dateTime(card.createdAt)} · last changed{' '}
        {dateTime(card.updatedAt)}
      </p>

      {editable ? (
        <Button
          onClick={() => save.mutate()}
          disabled={!priorityValid || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      ) : null}
    </div>
  );
}

function History({ id }: { id: string }) {
  const [status, setStatus] = useState('all');
  const authorizations = useAuthorizations(`/id-tokens/${id}/authorizations`, {
    status: status === 'all' ? undefined : status,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Where this card was used</h2>
          <p className="text-muted-foreground text-sm">
            Every time the card was presented and what the platform answered.
            Written by the event worker, so the last few seconds may be missing.
          </p>
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value ?? 'all')}
        >
          <SelectTrigger aria-label="Filter by result">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECISION_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AuthorizationTable
        query={authorizations}
        empty="This card has not been presented at a charger, or not with that result."
      />
    </section>
  );
}
