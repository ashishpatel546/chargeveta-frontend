'use client';

import { SecretOnce } from './copy';
import { dateTime } from '@/lib/format';

/**
 * What an admin sees after inviting someone or resetting their password
 * (doc 6 §22.2).
 *
 * Says plainly whether an email went, because the admin's next move depends on
 * it: with mail on, they are done and the link is a fallback; with mail off,
 * the link is the only way the person gets in and it is theirs to pass on.
 *
 * It shows a **link** rather than the bare token. The token alone was what
 * Phase K showed, and it left the recipient with a string and nowhere to put
 * it; the link opens the console's setup page with it already filled in.
 */
export function SetupLink({
  email,
  setupToken,
  expiresAt,
  emailQueued,
  kind,
}: {
  email: string;
  setupToken: string;
  expiresAt?: string;
  emailQueued?: boolean;
  kind: 'invitation' | 'reset';
}) {
  const link = `${window.location.origin}/setup?token=${encodeURIComponent(setupToken)}`;
  const what = kind === 'invitation' ? 'an invitation' : 'a password reset link';

  return (
    <div className="space-y-3">
      {emailQueued ? (
        <p className="text-sm">
          We have emailed {what} to <strong>{email}</strong>. It usually
          arrives within a minute. If it does not, send them the link below
          yourself.
        </p>
      ) : (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          This installation does not send email, so nothing has gone to{' '}
          <strong>{email}</strong>. Send them the link below yourself, over
          something you trust.
        </p>
      )}
      <SecretOnce
        title={kind === 'invitation' ? 'Setup link' : 'Reset link'}
        value={link}
        note={
          <>
            It works once
            {expiresAt ? <> and stops working {dateTime(expiresAt)}</> : null}.
            {kind === 'reset'
              ? ' Their current password keeps working until they use it.'
              : null}
          </>
        }
      />
    </div>
  );
}
