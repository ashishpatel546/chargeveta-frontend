'use client';

import { useQuery } from '@tanstack/react-query';
import { CreateTenantDialog } from './create-tenant-dialog';
import { ModulesCell, TenantActions } from './tenant-actions';
import { PageHeader } from '@/components/page-header';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { platformApiGet } from '@/lib/api/platform-client';
import type { PlatformTenantListItem } from '@/lib/api/platform-types';
import { date, dateTime } from '@/lib/format';

export function PlatformTenantsView() {
  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApiGet<PlatformTenantListItem[]>('/tenants'),
  });

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every operator on this installation, oldest first. Suspending one refuses all of its people and disconnects its chargers; nothing is deleted. Modules switch optional features, such as fleets, on per operator."
      >
        <CreateTenantDialog />
      </PageHeader>

      {tenants.isPending ? <Loading /> : null}
      {tenants.isError ? <Failed error={tenants.error} /> : null}
      {tenants.isSuccess && tenants.data.length === 0 ? (
        <Empty>No tenants yet. Create the first one.</Empty>
      ) : null}

      {tenants.isSuccess && tenants.data.length > 0 ? (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.data.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
                  <TableCell className="whitespace-normal">
                    <OwnerCell tenant={tenant} />
                  </TableCell>
                  <TableCell>
                    {tenant.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-ok/30 bg-ok/10 font-medium text-ok-ink"
                      >
                        active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        suspended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ModulesCell tenant={tenant} />
                  </TableCell>
                  <TableCell className="text-sm">{date(tenant.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <TenantActions tenant={tenant} />
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
 * Who the tenant's owner is, and whether they have got in yet: never signed
 * in means the setup link was not used, which is what "Reset owner password" is
 * for.
 */
function OwnerCell({ tenant }: { tenant: PlatformTenantListItem }) {
  const owner = tenant.owner;
  if (!owner) return <span className="text-muted-foreground text-sm">No owner</span>;
  return (
    <div className="space-y-0.5">
      <div className="text-sm">{owner.email}</div>
      <div className="text-muted-foreground text-xs">
        {!owner.isActive
          ? 'Deactivated'
          : owner.lastSignInAt
            ? `Last signed in ${dateTime(owner.lastSignInAt)}`
            : owner.setupLinkExpiresAt
              ? `Not signed in yet · link valid until ${dateTime(owner.setupLinkExpiresAt)}`
              : 'Not signed in yet · link expired'}
        {tenant.activeOwners > 1 ? ` · ${tenant.activeOwners} owners` : null}
      </div>
    </div>
  );
}
