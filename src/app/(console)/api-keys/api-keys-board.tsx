'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreateApiKeyDialog } from './create-api-key-dialog';
import { ConfirmDialog } from '../_shared/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { useCan } from '@/components/principal-context';
import { Empty, Failed, Loading } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import type { ApiKey } from '@/lib/api/types';
import { dateTime, since } from '@/lib/format';

export function ApiKeysBoard() {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiGet<ApiKey[]>('/api-keys'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiSend<void>('DELETE', `/api-keys/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('The key has been revoked.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="API keys"
        description="Long-lived credentials for the systems that talk to this API without a person behind them."
      >
        {canAdmin ? <CreateApiKeyDialog /> : null}
      </PageHeader>

      <div className="text-muted-foreground mb-4 space-y-1 rounded-md border p-3 text-sm">
        <p>
          A key goes in the request header:{' '}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            Authorization: Bearer &lt;key&gt;
          </code>
          .
        </p>
        <p>
          A key is for integrations only. It cannot be used to sign in to these
          screens, and it never reaches anything a signed-in person sees — so a
          leaked key exposes the API, not the console.
        </p>
      </div>

      {keys.isPending ? <Loading /> : null}
      {keys.isError ? <Failed error={keys.error} /> : null}
      {keys.isSuccess && keys.data.length === 0 ? (
        <Empty>No keys yet. Make one when something needs to call the API.</Empty>
      ) : null}

      {keys.isSuccess && keys.data.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>State</TableHead>
                {canAdmin ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.data.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="text-sm">{key.role}</TableCell>
                  <TableCell className="text-sm">
                    {dateTime(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {since(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {key.expiresAt ? dateTime(key.expiresAt) : 'never'}
                  </TableCell>
                  <TableCell>
                    {key.revokedAt ? (
                      <Badge variant="destructive">
                        revoked {dateTime(key.revokedAt)}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        in use
                      </Badge>
                    )}
                  </TableCell>
                  {canAdmin ? (
                    <TableCell>
                      {key.revokedAt ? null : (
                        <ConfirmDialog
                          trigger={<Button variant="destructive" size="sm" />}
                          triggerLabel="Revoke"
                          title={`Revoke ${key.name}?`}
                          description="Anything using this key stops working immediately. There is no way to bring it back; you would have to issue a new key and change whatever was using it."
                          confirmLabel="Revoke the key"
                          pending={revoke.isPending}
                          onConfirm={() => revoke.mutateAsync(key.id)}
                        />
                      )}
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
