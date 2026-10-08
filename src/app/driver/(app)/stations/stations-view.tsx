'use client';

import { useQuery } from '@tanstack/react-query';
import { HistoryIcon, LocateFixedIcon } from 'lucide-react';
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
import type {
  DriverSessionPage,
  DriverStationDto,
} from '@/lib/api/driver-types';
import { useDriverGeolocation } from './use-driver-geolocation';

/**
 * "Where can I charge?" — doc 6 §22.3's `/driver/stations/nearby`, plus a
 * fallback for the charger's own identity, which is what its QR code carries
 * (`GET /driver/stations/:identity`). Scanning that code is its own future
 * increment (doc 4 §8.3's ad-hoc guest flow needs a backend that does not
 * exist yet — see `progress-tracer.md`); typing the identity printed under
 * it already works today.
 */
/**
 * How far Nearby looks, in turn, until it finds a charger. The API refuses a
 * radius over GEOSEARCH_MAX_RADIUS_METERS (200 km by default).
 */
const SEARCH_RADII = [5_000, 25_000, 100_000] as const;

export function StationsView() {
  const geo = useDriverGeolocation();

  // Near first, then wider: a driver just outside town should see the
  // closest chargers there are, not "none within 5 km".
  const nearby = useQuery({
    queryKey: ['driver', 'stations', 'nearby', geo.coords?.latitude, geo.coords?.longitude],
    queryFn: async () => {
      for (const radius of SEARCH_RADII) {
        const stations = await driverApiGet<DriverStationDto[]>(
          '/driver/stations/nearby',
          {
            latitude: String(geo.coords!.latitude),
            longitude: String(geo.coords!.longitude),
            radiusMeters: String(radius),
          },
        );
        if (stations.length > 0) return { radius, stations };
      }
      return { radius: SEARCH_RADII[SEARCH_RADII.length - 1], stations: [] };
    },
    enabled: geo.coords !== null,
  });

  return (
    <>
      <PageHeader title="Nearby" />

      <IdentityLookup />

      {geo.status === 'loading' ? (
        <p className="text-muted-foreground mb-3 text-sm">Finding you…</p>
      ) : null}
      {geo.status === 'denied' || geo.status === 'error' ? (
        <div className="bg-card/60 mb-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-xl"
          >
            <LocateFixedIcon className="size-5" />
          </span>
          <div className="max-w-[40ch] space-y-1 text-sm">
            <p className="font-medium">
              {geo.status === 'denied'
                ? 'Location is off for this app'
                : 'We couldn’t find where you are'}
            </p>
            <p className="text-muted-foreground text-pretty">
              {geo.status === 'denied'
                ? 'Allow location in your browser’s site settings to see chargers near you. You can still type the code printed on a charger above.'
                : 'Check that location is on for your phone, then try again.'}
            </p>
          </div>
          <Button variant="outline" onClick={geo.retry}>
            Try again
          </Button>
        </div>
      ) : null}

      {nearby.isPending && geo.coords ? <Loading rows={3} /> : null}
      {nearby.isError ? <Failed error={nearby.error} /> : null}
      {nearby.isSuccess && nearby.data.stations.length === 0 ? (
        <Empty>
          No chargers within {nearby.data.radius / 1000} km of you. You can
          still type the code printed on a charger above.
        </Empty>
      ) : null}
      {nearby.isSuccess &&
      nearby.data.stations.length > 0 &&
      nearby.data.radius > SEARCH_RADII[0] ? (
        <p className="text-muted-foreground mb-3 text-sm">
          Nothing within {SEARCH_RADII[0] / 1000} km, so these are the closest
          within {nearby.data.radius / 1000} km.
        </p>
      ) : null}

      <div className="space-y-3">
        {nearby.data?.stations.map((station) => (
          <StationRow key={station.id} station={station} />
        ))}
      </div>

      {geo.status === 'ready' ? null : <UsedBefore />}
    </>
  );
}

/**
 * Where this driver has charged before, newest first — the way back to a
 * familiar charger when location can't help.
 */
function UsedBefore() {
  const sessions = useQuery({
    queryKey: ['driver', 'sessions', 'recent-stations'],
    queryFn: () =>
      driverApiGet<DriverSessionPage>('/driver/sessions', { limit: '30' }),
  });
  const places = new Map<string, { identity: string; site: string | null }>();
  for (const session of sessions.data?.items ?? []) {
    if (!places.has(session.stationIdentity)) {
      places.set(session.stationIdentity, {
        identity: session.stationIdentity,
        site: session.siteName,
      });
    }
  }
  if (places.size === 0) return null;
  return (
    <section aria-labelledby="used-before" className="mt-2 space-y-2">
      <h2 id="used-before" className="heading flex items-center gap-1.5 text-sm">
        <HistoryIcon aria-hidden className="text-muted-foreground size-4" />
        Chargers you’ve used
      </h2>
      <ul className="bg-card divide-y overflow-hidden rounded-xl border">
        {[...places.values()].slice(0, 5).map((place) => (
          <li key={place.identity}>
            <Link
              href={`/driver/stations/${encodeURIComponent(place.identity)}`}
              className="active:bg-muted flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {place.site ?? place.identity}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {place.identity}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
