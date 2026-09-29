'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM } from '@/lib/forms';
import { platformRedeemSetupAction } from '@/lib/server/platform-auth';

export function PlatformSetupForm({ setupToken }: { setupToken: string }) {
  const [state, action] = useActionState(platformRedeemSetupAction, EMPTY_FORM);

  return (
    <form action={action} className="space-y-4">
      {/* Posted back rather than read from the URL on the server, so the
          action does not depend on which page it was called from. */}
      <input type="hidden" name="setupToken" value={setupToken} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters. A few unrelated words is easier to remember
          than a short password with symbols, and harder to guess.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Type it again</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
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
      {pending ? 'Setting it…' : 'Set password and sign in'}
    </Button>
  );
}
