'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/components/principal-context';
import { Empty } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiSend } from '@/lib/api/client';
import type { Site, Station, Tariff } from '@/lib/api/types';
import { dateTime } from '@/lib/format';

/**
 * The things about a charger that an operator sets, rather than the charger
 * reporting.
 *
 * The password is write-only: the API stores a hash and will never show it
 * again, so this can offer to replace it and nothing else.
 */
export function StationSettingsPanel({ station }: { station: Station }) {
  const canAdmin = useCan('admin');

  if (!canAdmin) {
    return (
      <Empty>
        Only an administrator can change a charger’s settings.
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Placement station={station} />
      <Credential station={station} />
      <Quarantine station={station} />
      <Removal station={station} />
    </div>
  );
}

function Placement({ station }: { station: Station }) {
  const [locationId, setLocationId] = useState(station.locationId ?? 'none');
  const [tariffId, setTariffId] = useState(station.tariffId ?? 'none');
  const [isActive, setIsActive] = useState(station.isActive);
  const queryClient = useQueryClient();

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });
  const tariffs = useQuery({
    queryKey: ['tariffs'],
    queryFn: () => apiGet<Tariff[]>('/tariffs'),
  });

  const save = useMutation({
    mutationFn: () =>
      apiSend<Station>('PATCH', `/stations/${station.id}`, {
        locationId: locationId === 'none' ? null : locationId,
        tariffId: tariffId === 'none' ? null : tariffId,
        isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where it is, and what it charges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="site">Site</Label>
          <Select
            value={locationId}
            onValueChange={(value) => setLocationId(value ?? 'none')}
          >
            <SelectTrigger id="site" className="w-full">
              <SelectValue />
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
            The site carries the tax rate and the time zone a session is billed
            in.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tariff">Tariff</Label>
          <Select
            value={tariffId}
            onValueChange={(value) => setTariffId(value ?? 'none')}
          >
            <SelectTrigger id="tariff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Use the site’s tariff</SelectItem>
              {(tariffs.data ?? []).map((tariff) => (
                <SelectItem key={tariff.id} value={tariff.id}>
                  {tariff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            A tariff set here overrides the site’s, for this charger only.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="size-4"
          />
          Accept this charger’s connection
        </label>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}

function Credential({ station }: { station: Station }) {
  const [password, setPassword] = useState('');
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      apiSend<void>('PUT', `/stations/${station.id}/credential`, { password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      setPassword('');
      toast.success('Password set. Configure the charger with the same one.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connection password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {station.hasCredential
            ? 'A password is set. It cannot be read back — setting a new one replaces it, and the charger must be given the same one.'
            : 'No password is set yet, so this charger cannot connect.'}
        </p>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <p className="text-muted-foreground text-xs">
            Between 20 and 128 characters. Generate it rather than choosing it:
            nobody has to remember this one.
          </p>
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={password.length < 20 || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Set password'}
        </Button>
      </CardContent>
    </Card>
  );
}

function Quarantine({ station }: { station: Station }) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: () =>
      station.quarantinedAt
        ? apiSend<unknown>('DELETE', `/stations/${station.id}/quarantine`, {
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          })
        : apiSend<unknown>('POST', `/stations/${station.id}/quarantine`, {
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['station', station.id] });
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      setReason('');
      toast.success(
        station.quarantinedAt ? 'Let back in' : 'Quarantined and disconnected',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quarantine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          A quarantined charger is disconnected and refused, and anything it
          sends is dropped. It is for a charger that is flooding the system or
          behaving in a way that is corrupting its own records — not for taking
          one out of service, which is what the change-availability command is
          for.
        </p>
        {station.quarantinedAt ? (
          <p className="text-sm">
            Quarantined {dateTime(station.quarantinedAt)}
            {station.quarantinedBy ? ` by ${station.quarantinedBy}` : ''}.
            {station.quarantineReason
              ? ` Reason: ${station.quarantineReason}`
              : ''}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="Recorded against this charger"
          />
        </div>
        <Button
          variant={station.quarantinedAt ? 'outline' : 'destructive'}
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
        >
          {station.quarantinedAt ? 'Let it back in' : 'Quarantine'}
        </Button>
      </CardContent>
    </Card>
  );
}

function Removal({ station }: { station: Station }) {
  const [confirmation, setConfirmation] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => apiSend<void>('DELETE', `/stations/${station.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      toast.success(`${station.identity} removed`);
      router.push('/stations');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Remove this charger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Type the charger’s name to confirm. Its sessions and receipts are
          financial records and are not removed with it.
        </p>
        <Input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={station.identity}
          aria-label="Type the charger’s name to confirm"
        />
        <Button
          variant="destructive"
          disabled={confirmation !== station.identity || remove.isPending}
          onClick={() => remove.mutate()}
        >
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}
