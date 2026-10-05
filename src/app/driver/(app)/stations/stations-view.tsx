'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Empty, Failed, Loading } from '@/components/driver-query-state';
import { PageHeader } from '@/components/page-header';
import { ConnectorBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { driverApiGet } from '@/lib/api/driver-client';
import type { DriverStationDto } from '@/lib/api/driver-types';
import { useDriverGeolocation } from './use-driver-geolocation';

/**
 * "Where can I charge?" — doc 6 §22.3's `/driver/stations/nearby`, plus a
 * fallback for the charger's own identity, which is what its QR code carries
 * (`GET /driver/stations/:identity`). Scanning that code is its own future
 * increment (doc 4 §8.3's ad-hoc guest flow needs a backend that does not
 * exist yet — see `progress-tracer.md`); typing the identity printed under
 * it already works today.
 */
export function StationsView() {
  const geo = useDriverGeolocation();

  const nearby = useQuery({
    queryKey: ['driver', 'stations', 'nearby', geo.coords?.latitude, geo.coords?.longitude],
    queryFn: () =>
      driverApiGet<DriverStationDto[]>('/driver/stations/nearby', {
        latitude: String(geo.coords!.latitude),
        longitude: String(geo.coords!.longitude),
      }),
    enabled: geo.coords !== null,
  });

  return (
    <>
      <PageHeader title="Nearby" />

      <IdentityLookup />

      {geo.status === 'loading' ? (
        <p className="text-muted-foreground mb-3 text-sm">Finding you…</p>
      ) : null}
      {geo.status === 'denied' ? (
        <Empty>
          Location is off, so nearby chargers cannot be shown. Turn it on for
          this site, or look up a charger by the code on it above.
        </Empty>
      ) : null}
      {geo.status === 'error' ? (
        <Empty>
          Could not get your location.{' '}
          <button onClick={geo.retry} className="underline">
            Try again
          </button>
          .
        </Empty>
      ) : null}

      {nearby.isPending && geo.coords ? <Loading rows={3} /> : null}
      {nearby.isError ? <Failed error={nearby.error} /> : null}
      {nearby.isSuccess && nearby.data.length === 0 ? (
        <Empty>No chargers nearby.</Empty>
      ) : null}

      <div className="space-y-3">
        {nearby.data?.map((station) => (
          <StationRow key={station.id} station={station} />
        ))}
      </div>
    </>
  );
}

function IdentityLookup() {
  const router = useRouter();
  const [identity, setIdentity] = useState('');

  return (
    <form
      className="mb-4 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = identity.trim();
        if (trimmed) router.push(`/driver/stations/${encodeURIComponent(trimmed)}`);
      }}
    >
      <Label htmlFor="identity" className="sr-only">
        Charger code
      </Label>
      <Input
        id="identity"
        value={identity}
        onChange={(event) => setIdentity(event.target.value)}
        placeholder="Charger code (on the sticker)"
        spellCheck={false}
      />
      <Button type="submit" variant="outline">
        Find
      </Button>
    </form>
  );
}

function StationRow({ station }: { station: DriverStationDto }) {
  return (
    <Link href={`/driver/stations/${encodeURIComponent(station.identity)}`}>
      <Card size="sm">
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {station.siteName ?? station.identity}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {[station.address, station.city].filter(Boolean).join(', ') ||
                  station.identity}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {typeof station.distanceMeters === 'number' ? (
                <span className="text-muted-foreground text-xs">
                  {station.distanceMeters < 1000
                    ? `${Math.round(station.distanceMeters)} m`
                    : `${(station.distanceMeters / 1000).toFixed(1)} km`}
                </span>
              ) : null}
              <Badge
                variant="outline"
                className={
                  station.online
                    ? 'border-ok/30 bg-ok/10 font-medium text-ok-ink'
                    : 'text-muted-foreground'
                }
              >
                {station.online ? 'online' : 'offline'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {station.connectors.map((connector) => (
              <ConnectorBadge
                key={`${connector.evseId}-${connector.connectorId}`}
                status={connector.status}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
