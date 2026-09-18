import { Badge } from '@/components/ui/badge';
import type { IdToken } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * A card's state, in the colours an operator already reads on the board: green
 * is usable, red was taken out of service by a person, amber ran out on its own.
 */
const CARD_TONE: Record<IdToken['status'], string> = {
  Accepted:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  Blocked: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
  Expired: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500',
};

export function CardStatusBadge({ status }: { status: IdToken['status'] }) {
  return (
    <Badge variant="outline" className={cn('font-medium', CARD_TONE[status])}>
      {status}
    </Badge>
  );
}

/**
 * What one card read was answered with.
 *
 * `Unknown` and `undecided` have no counterpart on a card row: the first is a
 * card with no record here, the second is the platform never having been asked
 * because the engine could not reach it. Neither is a refusal by policy, so
 * neither is red.
 */
const DECISION_TONE: Record<string, string> = {
  Accepted:
    'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  Blocked: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
  Expired: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500',
  Unknown: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  undecided:
    'border-violet-600/30 bg-violet-600/10 text-violet-700 dark:text-violet-400',
};

export function DecisionBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', DECISION_TONE[status] ?? '')}
    >
      {status}
    </Badge>
  );
}
