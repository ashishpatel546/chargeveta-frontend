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
      className="border-caution/30 bg-caution/10 font-medium text-caution-ink"
    >
      fleet owes
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge
      variant="outline"
      className="border-ok/30 bg-ok/10 font-medium text-ok-ink"
    >
      active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      inactive
    </Badge>
  );
}
