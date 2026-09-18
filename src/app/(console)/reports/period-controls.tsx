'use client';

import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api/client';
import type { Site } from '@/lib/api/types';
import { MAX_DAYS } from './period';

/** The two dates every report takes, and the site both can be narrowed to. */
export function PeriodControls({
  idPrefix,
  from,
  to,
  siteId,
  onFrom,
  onTo,
  onSite,
  children,
}: {
  /** Both reports are on one screen, so their field ids have to differ. */
  idPrefix: string;
  from: string;
  to: string;
  siteId: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onSite: (value: string) => void;
  /** Anything else the report adds to the row, such as a grouping. */
  children?: React.ReactNode;
}) {
  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet<Site[]>('/locations'),
  });

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-from`} className="text-xs">
          From
        </Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs">
          To
        </Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          onChange={(event) => onTo(event.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-site`} className="text-xs">
          Site
        </Label>
        <Select value={siteId} onValueChange={(value) => onSite(value ?? 'all')}>
          <SelectTrigger id={`${idPrefix}-site`} className="w-48">
            <SelectValue placeholder="Every site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every site</SelectItem>
            {(sites.data ?? []).map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {children}

      <p className="text-muted-foreground w-full text-xs">
        Dates are read in each site’s own time zone, and a report covers at most{' '}
        {MAX_DAYS} days.
      </p>
    </div>
  );
}
