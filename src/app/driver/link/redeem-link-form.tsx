'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { EMPTY_FORM } from '@/lib/forms';
import { redeemLinkAction } from '@/lib/server/driver-auth';

/**
 * A real button press, not the page load itself: a mail scanner fetches this
 * page (a GET) to check the link is safe, but never clicks a button, so the
 * token is still good when the person who was emailed it actually arrives —
 * `redeemLinkAction`'s doc comment and `DriverAuthController.redeemLink`
 * ("A POST, not the link itself").
 */
export function RedeemLinkForm({ token }: { token: string }) {
  const [state, action] = useActionState(redeemLinkAction, EMPTY_FORM);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
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
      {pending ? 'Signing in…' : 'Continue'}
    </Button>
  );
}
