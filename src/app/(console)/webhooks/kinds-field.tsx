'use client';

import { Label } from '@/components/ui/label';
import type { NotificationKind } from '@/lib/api/types';

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'connector.faulted',
  'station.quarantined',
  'station.offline',
  'security.event',
];

export const KIND_LABEL: Record<NotificationKind, string> = {
  'connector.faulted': 'Connector faulted',
  'station.quarantined': 'Charger quarantined',
  'station.offline': 'Charger offline',
  'security.event': 'Security event',
};

/**
 * Which alerts an endpoint hears about.
 *
 * Nothing ticked means every kind, including kinds added later — which is what
 * the API does with an empty list, and the honest default for a receiver that
 * wants to see everything.
 */
export function KindsField({
  value,
  onChange,
}: {
  value: NotificationKind[];
  onChange: (kinds: NotificationKind[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Kinds</Label>
      <div className="space-y-1">
        {NOTIFICATION_KINDS.map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={value.includes(kind)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, kind]
                    : value.filter((candidate) => candidate !== kind),
                )
              }
            />
            <span>{KIND_LABEL[kind]}</span>
            <code className="text-muted-foreground font-mono text-xs">{kind}</code>
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Tick nothing to receive every kind, now and any added later.
      </p>
    </div>
  );
}
