import { Badge } from '@/components/ui/badge';
import type { IdToken } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * A card's state, in the colours an operator already reads on the board: green
 * is usable, red was taken out of service by a person, amber ran out on its own.
 */
const CARD_TONE: Record<IdToken['status'], string> = {
  Accepted:
    'border-ok/30 bg-ok/10 text-ok-ink',
  Blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  Expired: 'border-caution/30 bg-caution/10 text-caution-ink',
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
    'border-ok/30 bg-ok/10 text-ok-ink',
  Blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  Expired: 'border-caution/30 bg-caution/10 text-caution-ink',
  NoCredit:
    'border-caution/30 bg-caution/10 text-caution-ink',
  Unknown: 'border-border bg-muted text-muted-foreground',
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

/** A card whose sessions a sponsor pays for (doc 6 §22.4). */
export function FreeChargingBadge({ company }: { company: boolean }) {
  return (
    <Badge
      variant="outline"
      className="border-primary/20 bg-primary/5 font-medium text-primary"
    >
      {company ? 'Free · company' : 'Free'}
    </Badge>
  );
}
