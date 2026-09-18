'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { KindsField, KIND_LABEL } from './kinds-field';
import { ConfirmDialog } from '../_shared/confirm-dialog';
import { SecretOnce } from '../_shared/copy';
import { Empty, Failed, Loading } from '@/components/query-state';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  NotificationKind,
  WebhookDelivery,
  WebhookEndpoint,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const DELIVERY_TONE: Record<WebhookDelivery['status'], string> = {
  delivered:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  pending: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500',
  failed: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
};

export function WebhookCard({ endpoint }: { endpoint: WebhookEndpoint }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);
  const [rotated, setRotated] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });

  const patch = useMutation({
    mutationFn: (body: {
      url?: string;
      kinds?: NotificationKind[];
      isActive?: boolean;
    }) =>
      apiSend<WebhookEndpoint>('PATCH', `/webhook-endpoints/${endpoint.id}`, body),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotate = useMutation({
    mutationFn: () =>
      apiSend<{ secret: string }>(
        'POST',
        `/webhook-endpoints/${endpoint.id}/rotate-secret`,
      ),
    onSuccess: ({ secret }) => {
      invalidate();
      setRotated(secret);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      apiSend<void>('DELETE', `/webhook-endpoints/${endpoint.id}`),
    onSuccess: () => {
      invalidate();
      toast.success('The endpoint has been removed.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm break-all">
          {endpoint.url}
        </CardTitle>
        <CardDescription>
          Added {dateTime(endpoint.createdAt)} by {endpoint.createdBy}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1">
          {endpoint.isActive ? (
            <Badge
              variant="outline"
              className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
            >
              active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              paused
            </Badge>
          )}
          {endpoint.kinds.length === 0 ? (
            <Badge variant="outline">every kind</Badge>
          ) : (
            endpoint.kinds.map((kind) => (
              <Badge key={kind} variant="outline">
                {KIND_LABEL[kind] ?? kind}
              </Badge>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ isActive: !endpoint.isActive })}
          >
            {endpoint.isActive ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeliveriesOpen(true)}
          >
            Deliveries
          </Button>
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm" />}
            triggerLabel="Rotate secret"
            title="Rotate the signing secret?"
            description="A new secret is issued and shown once. The old one stops working the moment this is done, so every delivery fails verification until the receiver has the new one."
            confirmLabel="Rotate it"
            pending={rotate.isPending}
            onConfirm={() => rotate.mutateAsync()}
          />
          <ConfirmDialog
            trigger={<Button variant="destructive" size="sm" />}
            triggerLabel="Remove"
            title="Remove this endpoint?"
            description="Nothing more is delivered to it and its delivery history goes with it."
            confirmLabel="Remove it"
            pending={remove.isPending}
            onConfirm={() => remove.mutateAsync()}
          />
        </div>
      </CardContent>

      <EditDialog
        endpoint={endpoint}
        open={editing}
        onOpenChange={setEditing}
        pending={patch.isPending}
        onSave={(body) => patch.mutate(body)}
      />

      <DeliveriesDialog
        endpointId={endpoint.id}
        open={deliveriesOpen}
        onOpenChange={setDeliveriesOpen}
      />

      <Dialog
        open={rotated !== null}
        onOpenChange={(open) => !open && setRotated(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New signing secret</DialogTitle>
            <DialogDescription>
              The previous secret no longer verifies anything. Put this one into
              the receiver now.
            </DialogDescription>
          </DialogHeader>
          {rotated ? <SecretOnce title="Signing secret" value={rotated} /> : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EditDialog({
  endpoint,
  open,
  onOpenChange,
  pending,
  onSave,
}: {
  endpoint: WebhookEndpoint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSave: (body: {
    url?: string;
    kinds?: NotificationKind[];
    isActive?: boolean;
  }) => void;
}) {
  const [url, setUrl] = useState(endpoint.url);
  const [kinds, setKinds] = useState<NotificationKind[]>(endpoint.kinds);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from what the endpoint actually is, not from the
        // half-finished edit that was abandoned last time.
        if (next) {
          setUrl(endpoint.url);
          setKinds(endpoint.kinds);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit endpoint</DialogTitle>
          <DialogDescription>
            The signing secret is untouched by this. Rotate it separately if it
            needs changing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-url-${endpoint.id}`}>URL</Label>
            <Input
              id={`edit-url-${endpoint.id}`}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={500}
              spellCheck={false}
            />
          </div>
          <KindsField value={kinds} onChange={setKinds} />
        </div>

        <DialogFooter>
          <Button
            disabled={url.trim().length === 0 || pending}
            onClick={() => onSave({ url: url.trim(), kinds })}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({
  endpointId,
  open,
  onOpenChange,
}: {
  endpointId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deliveries = useQuery({
    queryKey: ['webhook-endpoints', endpointId, 'deliveries'],
    queryFn: () =>
      apiGet<WebhookDelivery[]>(`/webhook-endpoints/${endpointId}/deliveries`),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Deliveries</DialogTitle>
          <DialogDescription>
            The last 100 attempts, newest first.
          </DialogDescription>
        </DialogHeader>

        {deliveries.isPending ? <Loading rows={3} /> : null}
        {deliveries.isError ? <Failed error={deliveries.error} /> : null}
        {deliveries.isSuccess && deliveries.data.length === 0 ? (
          <Empty>Nothing has been delivered to this endpoint yet.</Empty>
        ) : null}

        {deliveries.isSuccess && deliveries.data.length > 0 ? (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last HTTP</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Next attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.data.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium',
                          DELIVERY_TONE[delivery.status],
                        )}
                      >
                        {delivery.status}
                      </Badge>
                      <p className="text-muted-foreground text-xs">
                        {dateTime(delivery.deliveredAt ?? delivery.createdAt)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{delivery.attempts}</TableCell>
                    <TableCell className="text-sm">
                      {delivery.lastStatus ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm whitespace-normal">
                      {delivery.lastError ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {delivery.status === 'delivered'
                        ? '—'
                        : dateTime(delivery.nextAttemptAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
