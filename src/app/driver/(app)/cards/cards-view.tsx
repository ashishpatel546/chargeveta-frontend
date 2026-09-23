'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { driverApiGet, driverApiSend } from '@/lib/api/driver-client';
import type { DriverCardDto } from '@/lib/api/driver-types';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<string, string> = {
  Accepted:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  Blocked: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
  Expired: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

/** Doc 6 §22.3 "Cards": the app card plus any physical one staff have linked. */
export function CardsView() {
  const cards = useQuery({
    queryKey: ['driver', 'cards'],
    queryFn: () => driverApiGet<DriverCardDto[]>('/driver/cards'),
  });

  return (
    <>
      <PageHeader
        title="Cards"
        description="A physical card is linked by your operator, not claimed here."
      />

      {cards.isPending ? <Loading rows={2} /> : null}
      {cards.isError ? <Failed error={cards.error} /> : null}
      {cards.isSuccess && cards.data.length === 0 ? (
        <Empty>No cards yet.</Empty>
      ) : null}

      <div className="space-y-3">
        {cards.data?.map((card) => <CardRow key={card.id} card={card} />)}
      </div>
    </>
  );
}

function CardRow({ card }: { card: DriverCardDto }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {card.label ?? (card.isAppCard ? 'App card' : card.token)}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {card.token}
            {card.isAppCard ? ' · issued with your account' : ''}
          </p>
          <p className="text-muted-foreground text-xs">
            Linked {dateTime(card.linkedAt)}
            {card.expiresAt ? ` · expires ${dateTime(card.expiresAt)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge
            variant="outline"
            className={cn('font-medium', STATUS_TONE[card.status])}
          >
            {card.status}
          </Badge>
          {card.status !== 'Blocked' ? <BlockCardDialog card={card} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockCardDialog({ card }: { card: DriverCardDto }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const block = useMutation({
    mutationFn: () =>
      driverApiSend<DriverCardDto>('POST', `/driver/cards/${card.id}/block`, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'cards'] });
      setOpen(false);
      setReason('');
      toast.success('Card blocked.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Lost or stolen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this card?</DialogTitle>
          <DialogDescription>
            It stops working on every charger at once. Only your operator can
            unblock it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="block-reason">Why (optional)</Label>
          <Input
            id="block-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Lost at the office"
            maxLength={200}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => block.mutate()}
            disabled={block.isPending}
          >
            {block.isPending ? 'Blocking…' : 'Block card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
