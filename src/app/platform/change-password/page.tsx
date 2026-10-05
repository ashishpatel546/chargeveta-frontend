import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Button } from '@/components/ui/button';
import {
  platformChangePasswordAction,
  platformSignOut,
} from '@/lib/server/platform-auth';
import { readPlatformAdmin } from '@/lib/server/platform-principal';
import { AuthLayout } from '@/components/auth-layout';

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
    <AuthLayout surface="platform">
      <div className="space-y-2">
        <h1 className="heading text-3xl">Change your password</h1>
        <p className="text-muted-foreground text-sm">
          Change the password for <strong>{me.email}</strong>. Anywhere else
          you are signed in is signed out; this browser stays signed in.
        </p>
      </div>
      {me.mustChangePassword ? (
        <p className="border-l-2 border-caution pl-3 text-sm text-caution-ink">
          You are signed in with a temporary password. Choose your own before
          carrying on.
        </p>
      ) : null}
      <ChangePasswordForm action={platformChangePasswordAction} />
      <div className="flex items-center justify-between text-sm">
        {me.mustChangePassword ? (
          <span />
        ) : (
          <Link
            href="/platform/dashboard"
            className="underline underline-offset-4"
          >
            Back to the dashboard
          </Link>
        )}
        <form action={platformSignOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
