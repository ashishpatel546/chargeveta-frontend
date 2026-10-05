'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM } from '@/lib/forms';
import { keepFormOnSubmit } from '@/lib/keep-form';
import { driverLoginAction } from '@/lib/server/driver-auth';

export function PasswordForm() {
  const [state, action, pending] = useActionState(driverLoginAction, EMPTY_FORM);

  return (
    <form
      action={action}
      onSubmit={keepFormOnSubmit(action)}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="pw-tenantSlug">Operator</Label>
        <Input
          id="pw-tenantSlug"
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
      <p className="text-muted-foreground text-center text-xs">
        <Link href="/driver/link" className="underline underline-offset-4">
          Email me a sign-in link instead
        </Link>
      </p>
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
