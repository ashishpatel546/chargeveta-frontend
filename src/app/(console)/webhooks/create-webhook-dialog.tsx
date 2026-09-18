'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KindsField } from './kinds-field';
import { SecretOnce } from '../_shared/copy';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { ApiError, apiSend } from '@/lib/api/client';
import type {
  CreatedWebhookEndpoint,
  NotificationKind,
} from '@/lib/api/types';

/** The server keeps endpoint secrets encrypted, and refuses without the key. */
const NO_ENCRYPTION_KEY =
  'This server has no webhook encryption key configured, so it cannot store an endpoint secret. Whoever runs the API has to set one before endpoints can be added.';

export function CreateWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [kinds, setKinds] = useState<NotificationKind[]>([]);
  const [created, setCreated] = useState<CreatedWebhookEndpoint | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      apiSend<CreatedWebhookEndpoint>('POST', '/webhook-endpoints', {
        url: url.trim(),
        ...(kinds.length > 0 ? { kinds } : {}),
      }),
    onSuccess: (endpoint) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      setCreated(endpoint);
      setUrl('');
      setKinds([]);
    },
    onError: (error: Error) =>
      setProblem(
        error instanceof ApiError && error.status === 503
          ? NO_ENCRYPTION_KEY
          : error.message,
      ),
  });

  function close() {
    setOpen(false);
    setCreated(null);
    setProblem(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button />}>Add endpoint</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Endpoint added</DialogTitle>
              <DialogDescription>
                Put this secret into the receiver before you close this. It is
                what every delivery is signed with.
              </DialogDescription>
            </DialogHeader>
            <SecretOnce
              title="Signing secret"
              value={created.secret}
              note={
                <>
                  Deliveries to {created.url} carry a{' '}
                  <code>ChargeVeta-Signature</code> header computed with it.
                </>
              }
            />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a webhook endpoint</DialogTitle>
              <DialogDescription>
                Alerts are posted to this address as they are raised. The
                signing secret is shown once, here.
              </DialogDescription>
            </DialogHeader>

            {problem ? (
              <Alert variant="destructive">
                <AlertTitle>The endpoint was not added</AlertTitle>
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/hooks/chargeveta"
                  maxLength={500}
                  spellCheck={false}
                />
                <p className="text-muted-foreground text-xs">
                  Must be https, and at most 500 characters.
                </p>
              </div>

              <KindsField value={kinds} onChange={setKinds} />
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  setProblem(null);
                  create.mutate();
                }}
                disabled={url.trim().length === 0 || create.isPending}
              >
                {create.isPending ? 'Adding…' : 'Add endpoint'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
