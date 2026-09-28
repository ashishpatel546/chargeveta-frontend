import { Badge } from '@/components/ui/badge';
import type { FleetSession } from '@/lib/api/fleet-types';

/** Who a settled session was billed to; nothing until it is settled. */
export function SessionBillingBadge({ session }: { session: FleetSession }) {
  if (session.collectedAtSession === null) {
    return <span className="text-muted-foreground text-xs">not settled</span>;
  }
  return session.collectedAtSession ? (
    <Badge variant="outline" className="text-muted-foreground">
      driver paid
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-600/30 bg-amber-600/10 font-medium text-amber-700 dark:text-amber-400"
    >
      fleet owes
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge
      variant="outline"
      className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
    >
      active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      inactive
    </Badge>
  );
}
