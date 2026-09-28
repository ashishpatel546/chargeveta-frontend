import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Depot } from '@/lib/api/fleet-types';
import { date } from '@/lib/format';

/**
 * A fleet's depots — sites recorded as the fleet's. Recorded only, by the
 * owner's decision: other cards can still charge there.
 */
export function DepotsTable({
  depots,
  actions,
}: {
  depots: Depot[];
  actions?: (depot: Depot) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead>Address</TableHead>
            <TableHead className="text-right">Chargers</TableHead>
            <TableHead>Since</TableHead>
            {actions ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {depots.map((depot) => (
            <TableRow key={depot.locationId}>
              <TableCell className="font-medium">{depot.name}</TableCell>
              <TableCell className="text-sm">
                {[depot.address, depot.city].filter(Boolean).join(', ') || '—'}
              </TableCell>
              <TableCell className="text-right text-sm">
                {depot.stationCount}
              </TableCell>
              <TableCell className="text-sm">{date(depot.since)}</TableCell>
              {actions ? (
                <TableCell className="text-right">{actions(depot)}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
