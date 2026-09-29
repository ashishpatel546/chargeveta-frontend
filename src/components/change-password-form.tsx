'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { EMPTY_FORM, type FormState } from '@/lib/forms';

/**
 * Current password, new password, the new one again. Shared by the staff
 * console (`/change-password`) and the platform console
 * (`/platform/change-password`); each passes its own server action, which
 * checks the same rules again and has the API check them a third time.
 */
export function ChangePasswordForm({
  action: submit,
}: {
  action: (previous: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, action] = useActionState(submit, EMPTY_FORM);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters, and not the one you have now. A few
          unrelated words is easier to remember than a short password with
          symbols, and harder to guess.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Type the new one again</Label>
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
      {pending ? 'Changing it…' : 'Change password'}
    </Button>
  );
}
