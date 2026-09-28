'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FleetDialog, type FleetInput } from './fleet-dialog';
import { ActiveBadge } from '@/components/fleet/billing-badge';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiSend } from '@/lib/api/client';
import { billingModeLabel, type Fleet } from '@/lib/api/fleet-types';

/** Doc 6 §23: the operator's fleets. */
export function FleetsBoard() {
  const canAdmin = useCan('admin');
  const router = useRouter();
  const queryClient = useQueryClient();

  const fleets = useQuery({
    queryKey: ['fleets'],
    queryFn: () => apiGet<Fleet[]>('/fleets'),
  });

  async function create(input: FleetInput) {
    let fleet: Fleet;
    try {
      fleet = await apiSend<Fleet>('POST', '/fleets', input);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ['fleets'] });
    router.push(`/fleets/${fleet.id}`);
  }

  return (
    <>
      <PageHeader
        title="Fleets"
        description="Companies whose drivers charge on your network with their own cards, and who pays for it."
      >
        {canAdmin ? (
          <FleetDialog onSave={create} trigger={<Button />} triggerLabel="Add fleet" />
        ) : null}
      </PageHeader>

      {fleets.isPending ? <Loading /> : null}
      {fleets.isError ? <Failed error={fleets.error} /> : null}
      {fleets.isSuccess && fleets.data.length === 0 ? (
        <Empty>No fleets yet.</Empty>
      ) : null}
      {fleets.isSuccess && fleets.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Who pays</TableHead>
                <TableHead className="text-right">Drivers</TableHead>
                <TableHead className="text-right">Vehicles</TableHead>
                <TableHead className="text-right">Depots</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleets.data.map((fleet) => (
                <TableRow key={fleet.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/fleets/${fleet.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {fleet.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {billingModeLabel(fleet.billingMode, fleet.invoiceCollectsAtSession)}
                  </TableCell>
                  <TableCell className="text-right">{fleet.memberCount}</TableCell>
                  <TableCell className="text-right">{fleet.vehicleCount}</TableCell>
                  <TableCell className="text-right">{fleet.depotCount}</TableCell>
                  <TableCell>
                    <ActiveBadge active={fleet.isActive} />
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
