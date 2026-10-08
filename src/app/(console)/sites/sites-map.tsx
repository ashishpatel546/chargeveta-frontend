'use client';

import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap, TileLayer } from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Site } from '@/lib/api/types';

/** What a pin says about the chargers at one site. */
export interface SiteLoad {
  chargers: number;
  online: number;
  charging: number;
}

/**
 * OpenStreetMap's own tiles: no key, attribution required, fine for a staff
 * console's traffic under the OSM tile usage policy. A busy deployment
 * should point this at its own or a paid tile provider. Dark mode tints the
 * same tiles in CSS (`.sites-map` in globals.css) rather than loading a
 * second set.
 */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

/**
 * The operator's sites on a map: one pin per site with coordinates, carrying
 * how many chargers stand there and turning amber while any of them is
 * charging (the app's one meaning of amber). The pin's popup links to those
 * chargers.
 *
 * Leaflet is loaded only here, on the client, when the map first renders —
 * it touches `window` at import, and no other screen needs it.
 */
export function SitesMap({
  sites,
  load,
}: {
  sites: readonly Site[];
  load: Map<string, SiteLoad>;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const tiles = useRef<TileLayer | null>(null);
  const pins = useRef<LayerGroup | null>(null);

  const placed = sites.filter(
    (site) => site.latitude !== null && site.longitude !== null,
  );
  // Rebuild pins only when what they show changes.
  const signature = JSON.stringify(
    placed.map((site) => [
      site.id,
      site.name,
      site.latitude,
      site.longitude,
      load.get(site.id),
    ]),
  );

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !holder.current) return;
      if (!map.current) {
        map.current = L.map(holder.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView([20.6, 78.9], 4);
        pins.current = L.layerGroup().addTo(map.current);
      }
      tiles.current ??= L.tileLayer(TILES, {
        attribution: ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map.current);

      const group = pins.current!;
      group.clearLayers();
      const points: [number, number][] = [];
      for (const site of placed) {
        const at: [number, number] = [
          Number(site.latitude),
          Number(site.longitude),
        ];
        points.push(at);
        const l = load.get(site.id) ?? { chargers: 0, online: 0, charging: 0 };
        const tone =
          l.charging > 0 ? 'charging' : l.online > 0 ? 'online' : 'quiet';
        const icon = L.divIcon({
          className: 'site-pin-wrap',
          html: `<span class="site-pin site-pin--${tone}">${l.chargers}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -16],
        });
        const status =
          l.charging > 0
            ? `${l.charging} charging now`
            : `${l.online} of ${l.chargers} online`;
        L.marker(at, { icon, title: site.name, keyboard: true })
          .bindPopup(
            `<div class="site-pop"><strong>${escapeHtml(site.name)}</strong>` +
              `<span>${escapeHtml([site.address, site.city].filter(Boolean).join(', ') || 'No address')}</span>` +
              `<span>${l.chargers} ${l.chargers === 1 ? 'charger' : 'chargers'}, ${status}</span>` +
              `<a href="/stations?site=${encodeURIComponent(site.id)}">Show its chargers</a></div>`,
          )
          .addTo(group);
      }
      if (points.length === 1) {
        map.current.setView(points[0], 14);
      } else if (points.length > 1) {
        map.current.fitBounds(L.latLngBounds(points), {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // `placed` and `load` are summarised by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div
      ref={holder}
      role="region"
      aria-label="Map of your sites"
      className="sites-map bg-muted isolate h-64 w-full overflow-hidden rounded-xl border md:h-80"
    />
  );
}
