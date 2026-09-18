'use client';

import { useQuery } from '@tanstack/react-query';
import { InviteUserDialog } from './invite-user-dialog';
import { UserActions } from './user-actions';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
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
import { apiGet } from '@/lib/api/client';
import type { ConsoleUser } from '@/lib/api/types';
import { dateTime } from '@/lib/format';

export function UsersBoard() {
  const canAdmin = useCan('admin');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<ConsoleUser[]>('/users'),
  });

  return (
    <>
      <PageHeader
        title="People"
        description="Who can sign in to this console, and what each of them is allowed to do."
      >
        {canAdmin ? <InviteUserDialog /> : null}
      </PageHeader>

      <div className="text-muted-foreground mb-4 space-y-1 rounded-md border p-3 text-sm">
        <p>
          The roles are a ladder: a <strong>viewer</strong> reads, an{' '}
          <strong>operator</strong> also starts and stops chargers, an{' '}
          <strong>admin</strong> also manages people, keys and settings, and an{' '}
          <strong>owner</strong> can do everything including managing admins.
        </p>
        <p>
          Nobody can change their own account, an admin cannot change another
          admin or an owner, and the last active owner cannot be deactivated.
          Deactivating somebody ends every session they have open.
        </p>
      </div>

      {users.isPending ? <Loading /> : null}
      {users.isError ? <Failed error={users.error} /> : null}
      {users.isSuccess && users.data.length === 0 ? (
        <Empty>Nobody has been added yet.</Empty>
      ) : null}

      {users.isSuccess && users.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Added</TableHead>
                {canAdmin ? <TableHead>Manage</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-sm">{user.role}</TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        deactivated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {dateTime(user.createdAt)}
                  </TableCell>
                  {canAdmin ? (
                    <TableCell className="whitespace-normal">
                      <UserActions user={user} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
