'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { Site, Tariff } from '@/lib/api/types';

interface Form {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  timeZone: string;
  tariffId: string;
  /** Held as a percentage, because that is what a rate is called out loud. */
  gstPercent: string;
  gstStateCode: string;
}

const NO_TARIFF = 'none';

/** A stored number into a text box: `null` and "not editing" are both empty. */
function boxed(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function initialForm(site?: Site): Form {
  return {
    name: site?.name ?? '',
    address: site?.address ?? '',
    city: site?.city ?? '',
    postalCode: site?.postalCode ?? '',
    country: site?.country ?? '',
    latitude: boxed(site?.latitude),
    longitude: boxed(site?.longitude),
    timeZone: site?.timeZone ?? '',
    tariffId: site?.tariffId ?? NO_TARIFF,
    gstPercent:
      site?.gstRateBp === null || site?.gstRateBp === undefined
        ? ''
        : String(site.gstRateBp / 100),
    gstStateCode: site?.gstStateCode ?? '',
  };
}

/** The reader's own zone list, when the browser has one to offer. */
function knownTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

/**
 * What the form cannot send, in the words the operator would use.
 *
 * Latitude and longitude are the rule worth stating: the API refuses half a
 * pair with a 400, and a table constraint refuses it underneath that, so
 * catching it here is the difference between a sentence and a rejected save.
 */
function problems(form: Form): string[] {
  const found: string[] = [];
  if (form.name.trim().length === 0) found.push('A name is needed.');

  const hasLat = form.latitude.trim() !== '';
  const hasLon = form.longitude.trim() !== '';
  if (hasLat !== hasLon) {
    found.push(
      'Latitude and longitude go together: give both, or leave both empty.',
    );
  }
  if (hasLat && hasLon) {
    const lat = Number(form.latitude);
    const lon = Number(form.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      found.push('Latitude is between −90 and 90.');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      found.push('Longitude is between −180 and 180.');
    }
  }

  if (form.country.trim() !== '' && !/^[A-Za-z]{2}$/.test(form.country.trim())) {
    found.push('The country is a two-letter code, such as IN.');
  }

  if (form.gstPercent.trim() !== '') {
    const percent = Number(form.gstPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      found.push('The GST rate is a percentage between 0 and 100.');
    } else if (Math.abs(percent * 100 - Math.round(percent * 100)) > 1e-9) {
      // The API stores basis points, so anything finer than a hundredth of a
      // percent would be rounded away without the operator being told.
      found.push('The GST rate goes to two decimal places at most.');
    }
  }

  if (
    form.gstStateCode.trim() !== '' &&
    !/^[0-9]{2}$/.test(form.gstStateCode.trim())
  ) {
    found.push('The GST state code is two digits, such as 29.');
  }

  return found;
}

/**
 * The payload.
 *
 * On a create an empty box is simply left out. On an edit it goes as `null`,
 * which is how the API is told to clear a field — leaving it out of a PATCH
 * means "unchanged", so there would otherwise be no way to remove a tariff or a
 * tax rate once one was set.
 */
function body(form: Form, editing: boolean): Record<string, unknown> {
  const text = (value: string): string | null | undefined => {
    const trimmed = value.trim();
    if (trimmed !== '') return trimmed;
    return editing ? null : undefined;
  };

  const hasCoordinates =
    form.latitude.trim() !== '' && form.longitude.trim() !== '';

  return {
    name: form.name.trim(),
    address: text(form.address),
    city: text(form.city),
    postalCode: text(form.postalCode),
    // `?.` would turn a deliberate null back into undefined, which a PATCH
    // reads as "leave it alone" — so the null has to survive the uppercasing.
    country: text(form.country.toUpperCase()),
    latitude: hasCoordinates ? Number(form.latitude) : editing ? null : undefined,
    longitude: hasCoordinates
      ? Number(form.longitude)
      : editing
        ? null
        : undefined,
    timeZone: text(form.timeZone),
    tariffId:
      form.tariffId === NO_TARIFF
        ? editing
          ? null
          : undefined
        : form.tariffId,
    gstRateBp:
      form.gstPercent.trim() === ''
        ? editing
          ? null
          : undefined
        : Math.round(Number(form.gstPercent) * 100),
    gstStateCode: text(form.gstStateCode),
  };
}

export function SiteDialog({
  site,
  tariffs,
}: {
  /** Absent when adding one. */
  site?: Site;
  tariffs: Tariff[];
}) {
  const editing = site !== undefined;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => initialForm(site));
  const queryClient = useQueryClient();
  const zones = knownTimeZones();
  const found = problems(form);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiSend<Site>('PATCH', `/locations/${site.id}`, body(form, true))
        : apiSend<Site>('POST', '/locations', body(form, false)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      setOpen(false);
      toast.success(editing ? `${saved.name} saved.` : `${saved.name} added.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening starts from what is stored, not from an abandoned draft.
        if (next) setForm(initialForm(site));
      }}
    >
      <DialogTrigger
        render={
          editing ? <Button variant="outline" size="sm" /> : <Button />
        }
      >
        {editing ? 'Edit' : 'Add site'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${site.name}` : 'Add a site'}</DialogTitle>
          <DialogDescription>
            A site carries the tariff, the tax rate and the time zone its
            chargers bill sessions by.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="site-name">Name</Label>
            <Input
              id="site-name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-address">Address</Label>
            <Input
              id="site-address"
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              maxLength={255}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="site-city">City</Label>
              <Input
                id="site-city"
                value={form.city}
                onChange={(event) => set('city', event.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-postal">Postcode</Label>
              <Input
                id="site-postal"
                value={form.postalCode}
                onChange={(event) => set('postalCode', event.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-country">Country</Label>
              <Input
                id="site-country"
                value={form.country}
                onChange={(event) => set('country', event.target.value)}
                placeholder="IN"
                maxLength={2}
                spellCheck={false}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-lat">Latitude</Label>
              <Input
                id="site-lat"
                value={form.latitude}
                onChange={(event) => set('latitude', event.target.value)}
                placeholder="12.9716"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-lon">Longitude</Label>
              <Input
                id="site-lon"
                value={form.longitude}
                onChange={(event) => set('longitude', event.target.value)}
                placeholder="77.5946"
                inputMode="decimal"
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Both or neither. They are what the driver apps search by, so half a
            pair is refused.
          </p>

          <div className="space-y-2">
            <Label htmlFor="site-zone">Time zone</Label>
            <Input
              id="site-zone"
              value={form.timeZone}
              onChange={(event) => set('timeZone', event.target.value)}
              placeholder="Asia/Kolkata"
              spellCheck={false}
              list={zones.length > 0 ? 'time-zones' : undefined}
            />
            {zones.length > 0 ? (
              <datalist id="time-zones">
                {zones.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            ) : null}
            <p className="text-muted-foreground text-xs">
              An IANA name. Time-of-day rates are priced in it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-tariff">Tariff</Label>
            <Select
              value={form.tariffId}
              onValueChange={(value) => set('tariffId', value ?? NO_TARIFF)}
            >
              <SelectTrigger id="site-tariff">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TARIFF}>No tariff</SelectItem>
                {tariffs.map((tariff) => (
                  <SelectItem key={tariff.id} value={tariff.id}>
                    {tariff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Used by the chargers here that have no tariff of their own.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-gst">GST rate</Label>
              <Input
                id="site-gst"
                value={form.gstPercent}
                onChange={(event) => set('gstPercent', event.target.value)}
                placeholder="18"
                inputMode="decimal"
              />
              <p className="text-muted-foreground text-xs">
                A percentage. Tariffs exclude tax and the receipt adds it; with
                no rate here, no receipt is issued.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-gst-state">GST state code</Label>
              <Input
                id="site-gst-state"
                value={form.gstStateCode}
                onChange={(event) => set('gstStateCode', event.target.value)}
                placeholder="29"
                maxLength={2}
                inputMode="numeric"
              />
            </div>
          </div>

          {found.length > 0 ? (
            <ul className="text-destructive space-y-1 text-xs">
              {found.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={found.length > 0 || save.isPending}
          >
            {save.isPending
              ? 'Saving…'
              : editing
                ? 'Save changes'
                : 'Add site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
