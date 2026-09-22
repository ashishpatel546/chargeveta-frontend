'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM } from '@/lib/forms';
import { registerDriverAction } from '@/lib/server/driver-auth';

/**
 * Registering does not sign in at once — it sends a confirmation link
 * (`registerDriverAction`'s doc comment), so success here is a message, not a
 * redirect, the same shape as the staff invitation flow's "check your email".
 */
export function RegisterForm() {
  const [state, action] = useActionState(registerDriverAction, EMPTY_FORM);

  if (state.message) {
    return (
      <p className="border-l-2 border-emerald-500 pl-3 text-sm text-emerald-700 dark:text-emerald-500">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
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
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Type it again</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Registering…' : 'Register'}
    </Button>
  );
}
