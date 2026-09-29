'use client';

import { useQuery } from '@tanstack/react-query';
import { CreateTenantDialog } from './create-tenant-dialog';
import { TenantActions } from './tenant-actions';
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
import type { PlatformTenant } from '@/lib/api/platform-types';
import { date } from '@/lib/format';

export function PlatformTenantsView() {
  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApiGet<PlatformTenant[]>('/tenants'),
  });

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every operator on this installation, oldest first. Suspending one refuses all of its people and disconnects its chargers; nothing is deleted."
      >
        <CreateTenantDialog />
      </PageHeader>

      {tenants.isPending ? <Loading /> : null}
      {tenants.isError ? <Failed error={tenants.error} /> : null}
      {tenants.isSuccess && tenants.data.length === 0 ? (
        <Empty>No tenants yet. Create the first one.</Empty>
      ) : null}

      {tenants.isSuccess && tenants.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.data.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
                  <TableCell>
                    {tenant.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        suspended
                      </Badge>
                    )}
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
