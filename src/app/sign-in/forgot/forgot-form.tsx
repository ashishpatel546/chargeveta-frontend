'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM } from '@/lib/forms';
import { requestPasswordReset } from '@/lib/server/auth';

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, EMPTY_FORM);

  if (state.message) {
    return (
      <p
        role="status"
        className="border-l-2 border-ok pl-3 text-sm text-ok-ink"
      >
        {state.message} It can take a minute to arrive; check your spam folder
        too. The link works once.
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
        <p className="text-muted-foreground text-xs">
          The same short name you sign in with. Leave it empty if this
          installation serves only one.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
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
      {pending ? 'Sending…' : 'Email me a reset link'}
    </Button>
  );
}
