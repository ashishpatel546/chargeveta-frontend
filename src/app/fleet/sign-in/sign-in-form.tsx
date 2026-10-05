'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM } from '@/lib/forms';
import { keepFormOnSubmit } from '@/lib/keep-form';
import { fleetSignInAction } from '@/lib/server/fleet-auth';

export function FleetSignInForm() {
  const [state, action, pending] = useActionState(fleetSignInAction, EMPTY_FORM);

  return (
    <form
      action={action}
      onSubmit={keepFormOnSubmit(action)}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="tenantSlug">Operator</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          autoComplete="organization"
          placeholder="your-operator-name"
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit pending={pending} />
    </form>
  );
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}
