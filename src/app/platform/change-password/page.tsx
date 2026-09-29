import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import {
  platformChangePasswordAction,
  platformSignOut,
} from '@/lib/server/platform-auth';
import { readPlatformAdmin } from '@/lib/server/platform-principal';

export const metadata: Metadata = { title: 'Change your password' };

/**
 * Where a platform admin changes their own password — forced while the API
 * says `mustChangePassword` (the seeded first admin always starts that way),
 * or chosen from the header. Outside `(app)` because that layout sends a
 * must-change admin here, and living under it would loop.
 */
export default async function PlatformChangePasswordPage() {
  const me = await readPlatformAdmin();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.appName} platform
        </h1>
        <p className="text-muted-foreground text-sm">
          Change the password for <strong>{me.email}</strong>. Anywhere else
          you are signed in is signed out; this browser stays signed in.
        </p>
      </div>
      {me.mustChangePassword ? (
        <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-500">
          You are signed in with a temporary password. Choose your own before
          carrying on.
        </p>
      ) : null}
      <ChangePasswordForm action={platformChangePasswordAction} />
      <div className="flex items-center justify-between text-sm">
        {me.mustChangePassword ? (
          <span />
        ) : (
          <Link href="/platform/tenants" className="underline underline-offset-4">
            Back to tenants
          </Link>
        )}
        <form action={platformSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
