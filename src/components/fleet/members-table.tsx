import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FleetMember } from '@/lib/api/fleet-types';
import { date } from '@/lib/format';
import { ActiveBadge } from './billing-badge';

/** A fleet's drivers and their cards. `actions` adds a last column (staff). */
export function MembersTable({
  members,
  actions,
}: {
  members: FleetMember[];
  actions?: (member: FleetMember) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Cards</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Account</TableHead>
            {actions ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.driverId}>
              <TableCell className="font-medium">{member.name ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {[member.email, member.phone].filter(Boolean).join(' · ') || '—'}
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  {member.cards.length === 0 ? (
                    <span className="text-muted-foreground text-sm">none</span>
                  ) : (
                    member.cards.map((card) => (
                      <Badge
                        key={card.id}
                        variant="outline"
                        className={card.isBlocked ? 'text-muted-foreground line-through' : ''}
                        title={card.isBlocked ? 'Blocked' : undefined}
                      >
                        {card.label ? `${card.label} ` : ''}…{card.tokenHint}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{date(member.joinedAt)}</TableCell>
              <TableCell>
                <ActiveBadge active={member.isActive} />
              </TableCell>
              {actions ? (
                <TableCell className="text-right">{actions(member)}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
