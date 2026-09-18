'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useCan, usePrincipal } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import type { TenantSettings } from '@/lib/api/types';

/** As the API validates it: state code, PAN, entity digit, Z, checksum. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SAC = /^[0-9]{4,8}$/;

export function SettingsBoard() {
  const settings = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<TenantSettings>('/tenant/settings'),
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="How this operator bills, and what it does when a card is already charging."
      />

      <WhoIsSignedIn />

      {settings.isPending ? <Loading rows={4} /> : null}
      {settings.isError ? <Failed error={settings.error} /> : null}
      {settings.isSuccess ? (
        // Keyed on what was loaded so a refetch elsewhere cannot quietly
        // replace what somebody is in the middle of typing.
        <SettingsForm key={JSON.stringify(settings.data)} settings={settings.data} />
      ) : null}
    </>
  );
}

function WhoIsSignedIn() {
  const principal = usePrincipal();
  return (
    <Card className="mb-4" size="sm">
      <CardHeader>
        <CardTitle>Signed in</CardTitle>
        <CardDescription>
          {principal.kind === 'user' ? principal.email : principal.name} —{' '}
          {principal.role}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function SettingsForm({ settings }: { settings: TenantSettings }) {
  const canAdmin = useCan('admin');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TenantSettings>(settings);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Partial<TenantSettings>) =>
      apiSend<TenantSettings>('PATCH', '/tenant/settings', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Settings saved.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Empty means "clear it", which the API spells as null. */
  function trimmed(value: string | null): string | null {
    const text = (value ?? '').trim();
    return text.length === 0 ? null : text;
  }

  function submit() {
    const gstin = trimmed(draft.gstin);
    if (gstin !== null && !GSTIN.test(gstin)) {
      setProblem(
        'The GSTIN does not look right. It is 15 characters: two state digits, a PAN, an entity character, a Z, and a check character.',
      );
      return;
    }
    const sacCode = trimmed(draft.sacCode);
    if (sacCode !== null && !SAC.test(sacCode)) {
      setProblem('The SAC code is 4 to 8 digits.');
      return;
    }
    const legalName = trimmed(draft.legalName);
    if (legalName !== null && legalName.length > 255) {
      setProblem('The legal name cannot be longer than 255 characters.');
      return;
    }
    const billingAddress = trimmed(draft.billingAddress);
    if (billingAddress !== null && billingAddress.length > 500) {
      setProblem('The billing address cannot be longer than 500 characters.');
      return;
    }
    setProblem(null);

    // Only what changed goes up: sending an untouched field back would rewrite
    // it with whatever this page loaded, which may no longer be current.
    const next: TenantSettings = {
      concurrentTxPolicy: draft.concurrentTxPolicy,
      unavailableCountsAs: draft.unavailableCountsAs,
      legalName,
      gstin,
      billingAddress,
      sacCode,
    };
    const body: Partial<TenantSettings> = {};
    for (const key of Object.keys(next) as (keyof TenantSettings)[]) {
      if (next[key] !== settings[key]) {
        Object.assign(body, { [key]: next[key] });
      }
    }
    if (Object.keys(body).length === 0) {
      toast.info('Nothing has changed.');
      return;
    }
    save.mutate(body);
  }

  const disabled = !canAdmin || save.isPending;

  return (
    <div className="max-w-2xl space-y-6">
      {!canAdmin ? (
        <p className="text-muted-foreground text-sm">
          These are what the operator is set to. Changing them needs an admin.
        </p>
      ) : null}

      {problem ? (
        <Alert variant="destructive">
          <AlertTitle>Nothing was saved</AlertTitle>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="concurrent">Two sessions on one card</Label>
        <Select
          value={draft.concurrentTxPolicy}
          disabled={disabled}
          onValueChange={(value) =>
            set(
              'concurrentTxPolicy',
              (value as TenantSettings['concurrentTxPolicy'] | null) ?? 'refuse',
            )
          }
        >
          <SelectTrigger id="concurrent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="refuse">refuse</SelectItem>
            <SelectItem value="allow">allow</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Whether one card may run two sessions at the same time. Refusing is
          the safer default: a card left in a second charger cannot run up a
          bill unnoticed.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unavailable">A connector an operator switched off</Label>
        <Select
          value={draft.unavailableCountsAs}
          disabled={disabled}
          onValueChange={(value) =>
            set(
              'unavailableCountsAs',
              (value as TenantSettings['unavailableCountsAs'] | null) ?? 'down',
            )
          }
        >
          <SelectTrigger id="unavailable" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="down">counts as downtime</SelectItem>
            <SelectItem value="excluded">excluded from the figure</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Decides how the availability report treats a connector that was
          deliberately made unavailable: as time the connector was down, or as
          time left out of the calculation altogether.
        </p>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div>
          <h2 className="text-sm font-medium">Billing identity</h2>
          <p className="text-muted-foreground text-xs">
            These are printed on every receipt. A receipt already issued keeps
            what it was issued with; changing them here only affects receipts
            issued from now on.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal-name">Legal name</Label>
          <Input
            id="legal-name"
            value={draft.legalName ?? ''}
            disabled={disabled}
            maxLength={255}
            onChange={(event) => set('legalName', event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            value={draft.gstin ?? ''}
            disabled={disabled}
            spellCheck={false}
            placeholder="27AAAAA0000A1Z5"
            onChange={(event) => set('gstin', event.target.value.toUpperCase())}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-address">Billing address</Label>
          <textarea
            id="billing-address"
            rows={3}
            maxLength={500}
            disabled={disabled}
            value={draft.billingAddress ?? ''}
            onChange={(event) => set('billingAddress', event.target.value)}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sac-code">SAC code</Label>
          <Input
            id="sac-code"
            value={draft.sacCode ?? ''}
            disabled={disabled}
            inputMode="numeric"
            placeholder="998714"
            onChange={(event) => set('sacCode', event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            The service accounting code the charging service is billed under, 4
            to 8 digits.
          </p>
        </div>
      </div>

      {canAdmin ? (
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      ) : null}
    </div>
  );
}
