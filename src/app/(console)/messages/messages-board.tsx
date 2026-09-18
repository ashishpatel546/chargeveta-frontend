'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  MessageChannel,
  MessageStatus,
  OutboxMessage,
} from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The outbox (doc 6 §22.2): every email, SMS and push this operator has sent,
 * or tried to, and what happened to it.
 *
 * What it is for is the question "did they get it?" — the invitation someone
 * says never arrived, the alert nobody's phone showed. So it shows who, when,
 * whether it went and, when it did not, the reason in the mail server's own
 * words.
 *
 * It never shows what a message said. The API does not return bodies at all:
 * an invitation carries a setup token, and a page that displayed it would let
 * an admin finish setting up someone else's account.
 */
export function MessagesBoard() {
  const [channel, setChannel] = useState<MessageChannel | 'all'>('all');
  const [status, setStatus] = useState<MessageStatus | 'all'>('all');

  const messages = useQuery({
    queryKey: ['messages', channel, status],
    queryFn: () =>
      apiGet<OutboxMessage[]>('/messages', {
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        limit: '100',
      }),
    // Sending takes the worker a few seconds; this is how a test email is
    // seen to go from pending to sent without anyone reloading.
    refetchInterval: 5_000,
  });

  return (
    <>
      <PageHeader
        title="Messages"
        description="Invitations, password resets and alerts sent by email, SMS and push — and whether each one went."
      />

      <TestSend />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={channel}
          onValueChange={(value) =>
            setChannel((value as MessageChannel | 'all' | null) ?? 'all')
          }
        >
          <SelectTrigger className="w-36" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="push">Push</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus((value as MessageStatus | 'all' | null) ?? 'all')
          }
        >
          <SelectTrigger className="w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="pending">Waiting</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="skipped">Not sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {messages.isPending ? <Loading rows={5} /> : null}
      {messages.isError ? <Failed error={messages.error} /> : null}
      {messages.isSuccess && messages.data.length === 0 ? (
        <Empty>Nothing has been sent yet.</Empty>
      ) : null}
      {messages.isSuccess && messages.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>What</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.data.map((message) => (
                <TableRow key={message.id}>
                  <TableCell className="whitespace-nowrap">
                    {dateTime(message.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div>{TEMPLATE_LABEL[message.template] ?? message.template}</div>
                    <div className="text-muted-foreground text-xs">
                      {CHANNEL_LABEL[message.channel]}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={message.toAddress}>
                    {message.channel === 'push'
                      ? 'a subscribed device'
                      : message.toAddress}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={message.status} />
                    {message.lastError && message.status !== 'sent' ? (
                      <div className="text-muted-foreground mt-1 max-w-80 text-xs">
                        {message.lastError}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {message.attempts}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

/**
 * Proves a channel works before something important depends on it. Push is
 * tested from Settings, beside the switch that turns it on for a device.
 */
function TestSend() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');

  const send = useMutation({
    mutationFn: (body: { channel: MessageChannel; to?: string }) =>
      apiSend<{ queued: number; note: string }>('POST', '/messages/test', body),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success(result.note);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm">
      <div className="mr-auto space-y-1">
        <p className="font-medium">Send yourself a test</p>
        <p className="text-muted-foreground text-xs">
          It goes through the same queue as everything else, so if it arrives,
          invitations will too.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={send.isPending}
        onClick={() => send.mutate({ channel: 'email' })}
      >
        Email me
      </Button>
      <Input
        className="h-8 w-40"
        placeholder="Phone number"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        aria-label="Phone number for a test SMS"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={send.isPending || phone.trim().length === 0}
        onClick={() => send.mutate({ channel: 'sms', to: phone.trim() })}
      >
        Text it
      </Button>
    </div>
  );
}

const TEMPLATE_LABEL: Record<string, string> = {
  'user.invitation': 'Invitation',
  'user.password-reset': 'Password reset',
  'notification.raised': 'Alert',
  'test.message': 'Test message',
};

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

/**
 * `skipped` is shown as "Not sent" because that is what it means to the
 * reader: nothing left the server — mail is switched off, there is no SMS
 * provider, or the device has gone. The reason is printed underneath.
 */
const STATUS: Record<MessageStatus, { label: string; tone: string }> = {
  pending: {
    label: 'Waiting',
    tone: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400',
  },
  sent: {
    label: 'Sent',
    tone: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  },
  skipped: {
    label: 'Not sent',
    tone: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  },
  failed: {
    label: 'Failed',
    tone: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
  },
};

function StatusBadge({ status }: { status: MessageStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <Badge variant="outline" className={cn('font-medium', tone)}>
      {label}
    </Badge>
  );
}
