'use client';

import { SecretOnce } from '@/app/(console)/_shared/copy';
import type { PlatformAdminSetupLink } from '@/lib/api/platform-types';
import { dateTime } from '@/lib/format';

/**
 * A platform admin's setup or reset link. Never emailed — platform admins
 * belong to no tenant, and mail goes out through a tenant's outbox — so this
 * says plainly that handing it over is the issuer's job.
 */
export function AdminSetupLink({
  email,
  link,
}: {
  email: string;
  link: PlatformAdminSetupLink;
}) {
  return (
    <div className="space-y-3">
      <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
        Nothing has been emailed. Send <strong>{email}</strong> the{' '}
        {link.setupUrl ? 'link' : 'token'} below yourself, over something you
        trust.
      </p>
      <SecretOnce
        title={link.setupUrl ? 'Setup link' : 'Setup token'}
        value={link.setupUrl ?? link.setupToken}
        note={
          <>
            It works once and stops working {dateTime(link.setupTokenExpiresAt)}.
            {link.setupUrl
              ? null
              : ' The API has no public console address configured: they open the console’s /platform/setup page with ?token= followed by this value.'}
          </>
        }
      />
    </div>
  );
}
