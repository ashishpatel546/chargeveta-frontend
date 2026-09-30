'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCan, usePrincipal } from '@/components/principal-context';
import { Failed, Loading } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiGet, apiSend } from '@/lib/api/client';
import type { AlertPreferences } from '@/lib/api/types';

const QUERY_KEY = ['my-alert-preferences'];

/**
 * The signed-in person's own choice of how they are alerted (PUT
 * /users/me/alert-preferences, doc 6 §22.2, §22.4): whether alerts are pushed
 * to their devices, and — for owners and admins, the only people a stuck
 * session is escalated to — whether that escalation emails and texts them.
 *
 * Anyone may set their own and nobody anyone else's; the API reads whose from
 * the session. The whole set is saved at once, as shown, so a save never
 * merges with something older.
 */
export function MyAlertPreferencesCard() {
  const principal = usePrincipal();
  const preferences = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet<AlertPreferences>('/users/me/alert-preferences'),
    enabled: principal.kind === 'user',
  });

  // An API key has no devices, inbox or phone; the API refuses it here too.
  if (principal.kind !== 'user') return null;

  return (
    <Card className="mb-4" size="sm">
      <CardHeader>
        <CardTitle>Your alerts</CardTitle>
        <CardDescription>
          What reaches you when something needs attention. Every alert stays on
          the Alerts board whatever you choose here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {preferences.isPending ? <Loading rows={3} /> : null}
        {preferences.isError ? <Failed error={preferences.error} /> : null}
        {preferences.isSuccess ? (
          // Keyed on what was loaded, so a refetch cannot replace a choice
          // somebody is in the middle of making.
          <PreferencesForm
            key={JSON.stringify(preferences.data)}
            saved={preferences.data}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function PreferencesForm({ saved }: { saved: AlertPreferences }) {
  const escalatedTo = useCan('admin');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(saved);
  const set = (flag: keyof AlertPreferences) => (on: boolean) =>
    setDraft((current) => ({ ...current, [flag]: on }));
  const changed = (Object.keys(saved) as (keyof AlertPreferences)[]).some(
    (flag) => saved[flag] !== draft[flag],
  );

  const save = useMutation({
    mutationFn: (value: AlertPreferences) =>
      apiSend<AlertPreferences>('PUT', '/users/me/alert-preferences', value),
    onSuccess: (now) => {
      queryClient.setQueryData(QUERY_KEY, now);
      toast.success('Your alert preferences are saved.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft);
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pushes to your devices</legend>
        <Toggle
          id="pref-push-alerts"
          checked={draft.pushAlerts}
          onChange={set('pushAlerts')}
          label="Push alerts to my devices"
          hint="Critical alerts — a quarantined charger, a session that cannot be stopped — to every browser you turned alerts on in, below."
        />
        <Toggle
          id="pref-push-warnings"
          checked={draft.pushAlerts && draft.pushWarnings}
          disabled={!draft.pushAlerts}
          onChange={set('pushWarnings')}
          label="Warnings too"
          hint="A faulted connector, a charger gone quiet. Off: only critical alerts."
        />
      </fieldset>

      {escalatedTo ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            When a session cannot be stopped and nobody answers
          </legend>
          <Toggle
            id="pref-escalation-email"
            checked={draft.escalationEmail}
            onChange={set('escalationEmail')}
            label="Email me"
          />
          <Toggle
            id="pref-escalation-sms"
            checked={draft.escalationSms}
            onChange={set('escalationSms')}
            label="Text me"
            hint="SMS, and WhatsApp where it is on, to your phone number above."
          />
          <p className="text-muted-foreground text-xs">
            If every owner and admin turns one of these off, the owners still
            get it: a charging session nobody can stop is never left with
            nobody told.
          </p>
        </fieldset>
      ) : null}

      <Button type="submit" disabled={save.isPending || !changed}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

function Toggle({
  id,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="text-sm">
        <span className={disabled ? 'text-muted-foreground' : undefined}>
          {label}
        </span>
        {hint ? (
          <span className="text-muted-foreground block text-xs">{hint}</span>
        ) : null}
      </label>
    </div>
  );
}
