'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiSend } from '@/lib/api/client';
import { apiGet } from '@/lib/api/client';
import type { OcppVersion, Site, Station } from '@/lib/api/types';

/**
 * Registers a charger.
 *
 * The identity is the name the charger will introduce itself by on its
 * WebSocket URL, and it cannot be changed later without the charger being
 * reconfigured — so it is the one field with its own explanation.
 */
export function AddStationDialog() {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState('');
  const [ocppVersion, setOcppVersion] = useState<OcppVersion>('1.6');
  const [locationId, setLocationId] = useState<string>('none');
  const queryClient = useQueryClient();
  const router = useRouter();

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      apiSend<Station>('POST', '/stations', {
        identity: identity.trim(),
        ocppVersion,
        ...(locationId === 'none' ? {} : { locationId }),
      }),
    onSuccess: (station) => {
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      setOpen(false);
      setIdentity('');
      toast.success(`${station.identity} added. Give it a password next.`);
      router.push(`/stations/${station.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add charger</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a charger</DialogTitle>
          <DialogDescription>
            It will be able to connect once you set its password, on the page
            that opens next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identity">Charger name</Label>
            <Input
              id="identity"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="CP001"
              spellCheck={false}
            />
            <p className="text-muted-foreground text-xs">
              Exactly the name the charger is configured to connect as. Letters,
              digits and <code>. _ ~ -</code> only, and it cannot be changed
              afterwards.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ocpp">OCPP version</Label>
            <Select
              value={ocppVersion}
              onValueChange={(value) =>
                setOcppVersion((value as OcppVersion | null) ?? '1.6')
              }
            >
              <SelectTrigger id="ocpp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.6">1.6</SelectItem>
                <SelectItem value="2.0.1">2.0.1</SelectItem>
                <SelectItem value="2.1">2.1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Select
              value={locationId}
              onValueChange={(value) => setLocationId(value ?? 'none')}
            >
              <SelectTrigger id="site">
                <SelectValue placeholder="No site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No site</SelectItem>
                {(sites.data ?? []).map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              A site carries the tariff, the tax rate and the time zone a
              session is billed by.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={identity.trim().length === 0 || create.isPending}
          >
            {create.isPending ? 'Adding…' : 'Add charger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
