'use client';

import { SecretOnce } from '@/app/(console)/_shared/copy';
import type { OwnerSetupLink } from '@/lib/api/platform-types';
import { dateTime } from '@/lib/format';

/**
 * The link a tenant's owner chooses their password from, after creating the
 * tenant or issuing a new link.
 *
 * The API builds the link itself when it knows the console's public address
 * (`setupUrl`); otherwise only the bare token comes back, and that is shown
 * instead — the owner pastes it into the console's `/setup` page, or the
 * admin builds the link by hand. Says plainly whether an email went, because
 * the admin's next move depends on it.
 */
export function OwnerLink({
  email,
  link,
  kind,
}: {
  email: string;
  link: OwnerSetupLink;
  kind: 'invitation' | 'reset';
}) {
  return (
    <div className="space-y-3">
      {link.emailQueued ? (
        <p className="text-sm">
          We have emailed {kind === 'invitation' ? 'an invitation' : 'a new link'}{' '}
          to <strong>{email}</strong>. If it does not arrive, send them the{' '}
          {link.setupUrl ? 'link' : 'token'} below yourself.
        </p>
      ) : (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          No email has gone to <strong>{email}</strong>. Send them the{' '}
          {link.setupUrl ? 'link' : 'token'} below yourself, over something you
          trust.
        </p>
      )}
      <SecretOnce
        title={link.setupUrl ? 'Owner setup link' : 'Owner setup token'}
        value={link.setupUrl ?? link.setupToken}
        note={
          <>
            It works once and stops working {dateTime(link.setupTokenExpiresAt)}.
            {link.setupUrl
              ? null
              : ' The API has no public console address configured, so there is no ready-made link: the owner opens the console’s /setup page with ?token= followed by this value.'}
          </>
        }
      />
    </div>
  );
}
