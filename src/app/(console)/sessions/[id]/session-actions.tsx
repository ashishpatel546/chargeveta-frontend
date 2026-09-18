'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { OutcomeBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { ApiError, apiSend } from '@/lib/api/client';
import type { CommandResult, Receipt } from '@/lib/api/types';

/**
 * Asks the charger to end the session.
 *
 * The API answers 200 whatever happened, because "the charger refused" and
 * "the charger never heard us" are both successful round trips through the
 * platform — so the outcome is read off the body rather than the status. The
 * session itself only changes once the charger reports the stop, which is why
 * nothing here writes the row as stopped.
 */
export function StopSessionButton({ id }: { id: string }) {
  const [result, setResult] = useState<CommandResult | null>(null);
  const queryClient = useQueryClient();

  const stop = useMutation({
    mutationFn: () =>
      apiSend<CommandResult>('POST', `/transactions/${id}/remote-stop`),
    onSuccess: (outcome) => {
      setResult(outcome);
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (outcome.outcome === 'answered') {
        toast.success(`The charger answered ${outcome.status ?? 'nothing'}`);
      } else if (outcome.delivered === false) {
        toast.error('The request never reached the charger');
      } else {
        toast.error(`The charger did not stop: ${outcome.outcome.replace(/_/g, ' ')}`);
      }
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409) {
        // Already stopped: the event that ended it landed while this page was
        // open, so the row is what is stale, not the request.
        void queryClient.invalidateQueries({ queryKey: ['transactions'] });
        toast.info(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
      >
        {stop.isPending ? 'Asking the charger…' : 'Stop this session'}
      </Button>
      {result ? (
        <div className="flex items-center gap-2 text-xs">
          <OutcomeBadge outcome={result.outcome} />
          <span className="text-muted-foreground">
            {result.outcome === 'answered'
              ? (result.status ?? 'no status')
              : (result.detail ?? 'no detail')}
            {result.delivered === false ? ' · never reached the charger' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Issues a receipt for a session that did not get one automatically.
 *
 * A receipt is normally written when the session is priced; this is the way
 * back after the tenant's or the site's billing details were missing at that
 * moment, or after an earlier receipt was credited in full.
 */
export function IssueReceiptButton({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const queryClient = useQueryClient();

  const issue = useMutation({
    mutationFn: () => apiSend<Receipt>('POST', `/transactions/${id}/receipts`),
    onSuccess: (issued) => {
      setReceipt(issued);
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success(`Receipt ${issued.number} issued`);
    },
    onError: (error: Error) => {
      // The API distinguishes "there already is one" from "one cannot be made
      // yet, and here is what is missing"; both arrive as its own message.
      toast.error(error.message);
    },
  });

  if (receipt) {
    return (
      <Button
        variant="outline"
        render={<Link href={`/receipts/${receipt.id}`} />}
        nativeButton={false}
      >
        Open receipt {receipt.number}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => issue.mutate()}
      disabled={issue.isPending}
    >
      {issue.isPending ? 'Issuing…' : 'Issue a receipt'}
    </Button>
  );
}
